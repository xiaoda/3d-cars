"""复核 PnP 多解，不改骨架、标注或正式相机；需已有 numpy / opencv-python。"""
import hashlib
import json
import math
from pathlib import Path
import cv2
import numpy as np


def solve_candidates(world, pixels, camera_matrix, expected_side):
    world=np.array(world,dtype=np.float64,copy=True)
    pixels=np.array(pixels,dtype=np.float64,copy=True)
    k=np.array(camera_matrix,dtype=np.float64,copy=True)
    if (world.ndim!=2 or world.shape[1:]!=(3,) or len(world)<4 or pixels.shape!=(len(world),2)
            or k.shape!=(3,3) or not all(np.isfinite(a).all() for a in [world,pixels,k])
            or np.linalg.matrix_rank(world-world.mean(axis=0))<2 or k[0,0]<=0 or k[1,1]<=0
            or expected_side not in [-1,1]):
        raise ValueError('有限且非共线的至少四组对应点、相机内参和车辆侧别是必需的')
    methods=[('SQPNP',cv2.SOLVEPNP_SQPNP),('EPNP',cv2.SOLVEPNP_EPNP)]
    if len(world)==4: methods.append(('AP3P',cv2.SOLVEPNP_AP3P))
    candidates=[]
    for name,flag in methods:
        try:
            solutions=cv2.solvePnPGeneric(world,pixels,k,None,flags=flag)
            if not solutions[0]:
                candidates.append(dict(method=name,branchIndex=-1,rejections=['no-solution'],rmsPx=None))
                continue
        except cv2.error as e:
            candidates.append(dict(method=name,branchIndex=-1,rejections=['solver-error'],errorCode=e.code,rmsPx=None))
            continue
        for branch,(rv,tv) in enumerate(zip(solutions[1],solutions[2])):
            try:
                rv,tv=cv2.solvePnPRefineLM(world,pixels,k,None,rv.copy(),tv.copy())
                rotation=cv2.Rodrigues(rv)[0]
                position=(-rotation.T@tv).reshape(3)
                projected=cv2.projectPoints(world,rv,tv,k,None)[0].reshape(-1,2)
                errors=np.linalg.norm(projected-pixels,axis=1)
                depth=(rotation@world.T+tv)[2]
                if not all(np.isfinite(a).all() for a in [rotation,tv,position,projected,errors,depth]):
                    candidates.append(dict(method=name,branchIndex=branch,rejections=['non-finite'],rmsPx=None))
                    continue
                rejected=[]
                if min(depth)<=.05 or max(depth)>=200: rejected.append('depth-clipped')
                if position[2]*expected_side<=0: rejected.append('wrong-side')
                if not .1<position[1]<4: rejected.append('height-prior')
                candidates.append(dict(method=name,branchIndex=branch,position=position.tolist(),
                    rotation=rotation.tolist(),translation=tv.reshape(3).tolist(),projected=projected.tolist(),
                    errorsPx=errors.tolist(),rmsPx=float(np.sqrt(np.mean(errors**2))),rejections=rejected))
            except cv2.error as e:
                candidates.append(dict(method=name,branchIndex=branch,rejections=['refinement-error'],errorCode=e.code,rmsPx=None))
    return candidates


def camera_record(source_id, rotation, translation, focal, width, height):
    rotation=np.asarray(rotation,dtype=float); translation=np.asarray(translation,dtype=float).reshape(3)
    position=-rotation.T@translation
    three_rotation=rotation.T@np.diag([1.,-1.,-1.])
    vector=cv2.Rodrigues(three_rotation)[0].reshape(3); angle=np.linalg.norm(vector)
    quaternion=np.r_[vector/angle*math.sin(angle/2),math.cos(angle/2)] if angle>1e-12 else np.array([0.,0.,0.,1.])
    return dict(sourceId=source_id,position=position.tolist(),quaternion=quaternion.tolist(),
        fovY=math.degrees(2*math.atan(height/(2*focal))),imageWidth=width,imageHeight=height,
        crop=dict(x=0,y=0,width=width,height=height),near=.05,far=200)


def generate_review(root):
    data=root/'src/vehicles/bmw-g20/evidence'
    paths={name:data/name for name in ['skeleton.json','landmarks.json','cameras.json']}
    content={name:json.loads(p.read_text(encoding='utf8')) for name,p in paths.items()}
    skeleton=content['skeleton.json'];landmarks=content['landmarks.json']
    evidence=json.loads((root/'docs/research/bmw-g20/config-lock.json').read_text(encoding='utf8'))
    reports=[]; alternatives=[]
    for photo in landmarks['photos']:
        if photo['sourceId'] not in evidence['fitSourceIds'] or photo['sourceId'] in evidence['holdoutSourceIds']:
            raise ValueError('复核不得消耗留出图')
        pts=[p for p in photo['points'] if p['use']=='camera' and p['visibility']=='visible']
        world=np.array([skeleton['points'][p['id']] for p in pts],dtype=float)
        width,height=photo['imageWidth'],photo['imageHeight'];side=-1 if photo['sourceId']=='P90549627' else 1
        candidates=[]
        for annotation,field in [('original','pixel'),('repeat','repeatPixel')]:
            pixels=np.array([p[field] for p in pts],dtype=float)
            for factor in [.85,1.,1.15]:
                focal=width*photo['exifFocalMm']/36*factor
                k=np.array([[focal,0,width/2],[0,focal,height/2],[0,0,1]],dtype=float)
                for c in solve_candidates(world,pixels,k,side):
                    item=dict(id=f"{photo['sourceId']}-{annotation}-{factor}-{c['method']}-{c['branchIndex']}",annotation=annotation,focalFactor=factor,**c)
                    if not c['rejections']:
                        item['camera']=camera_record(photo['sourceId'],c['rotation'],c['translation'],focal,width,height)
                    candidates.append(item)
        baseline=next(c for c in content['cameras.json']['cameras'] if c['sourceId']==photo['sourceId'])
        admissible=[c for c in candidates if not c['rejections'] and c['annotation']=='original' and c['focalFactor']==1.]
        selected=min(admissible,key=lambda c:c['rmsPx']) if admissible else None
        report=dict(sourceId=photo['sourceId'],pointIds=[p['id'] for p in pts],pointCount=len(pts),
            baseline=baseline,candidates=candidates,exifCandidateId=selected['id'] if selected else None)
        reports.append(report)
        if photo['sourceId']=='P90549635' and selected:
            alternatives.append(dict(id='side-exif-low',sourceId=photo['sourceId'],label='近侧 EXIF 低机位候选',
                candidateId=selected['id'],camera=selected['camera'],rmsPx=selected['rmsPx'],
                note='相同骨架与标注的另一个局部解，不是真实相机认证；不覆盖原基线。'))
        print(photo['sourceId'],'original valid',sum(not c['rejections'] and c['annotation']=='original' for c in candidates),
            'EXIF candidate',None if selected is None else [round(v,3) for v in selected['position']])
    result=dict(schemaVersion=1,id='bmw-g20-camera-review-round1',skeletonId=skeleton['id'],
        method='SQPnP/EPnP；四点额外枚举 AP3P 所有返回分支；逐个 LM 细化；不统计重复收敛为独立证据。',
        limitations=['全部三维对应为近似骨架','重复标注为同一审阅者，不是独立测量或置信区间','物理先验不是相机测量','留出图未参与'],
        policy=dict(focalFactors=[.85,1.,1.15],cameraHeightMetres=[.1,4.],allowAutoPromotion=False),
        versions=dict(opencv=cv2.__version__,numpy=np.__version__),
        hashEncoding='sha256-utf8-lf',
        inputHashes={name:hashlib.sha256(p.read_text(encoding='utf8').encode('utf8')).hexdigest() for name,p in paths.items()},reports=reports)
    (root/'docs/research/bmw-g20/camera-review-round1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf8')
    (data/'camera-alternatives.json').write_text(json.dumps(dict(schemaVersion=1,skeletonId=skeleton['id'],alternatives=alternatives),ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf8')


if __name__=='__main__': generate_review(Path(__file__).resolve().parents[1])
