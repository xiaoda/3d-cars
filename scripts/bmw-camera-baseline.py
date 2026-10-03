"""离线生成相机初值；不改图、不改骨架、不读留出图。需 numpy / opencv-python。

三维对应是近似骨架，结果不是实车真实相机标定。
浏览器只用 Three.js 和输出 JSON，不依赖 Python/OpenCV。
"""
from pathlib import Path
import json, math
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'src/vehicles/bmw-g20/evidence'
skeleton = json.loads((DATA / 'skeleton.json').read_text(encoding='utf-8'))
landmarks = json.loads((DATA / 'landmarks.json').read_text(encoding='utf-8'))
sources = json.loads((ROOT / 'docs/research/bmw-g20/config-lock.json').read_text(encoding='utf-8'))
records, reports = [], []
for photo in landmarks['photos']:
    assert photo['sourceId'] in sources['fitSourceIds'], '留出照片禁止用于生成开发基线'
    pts = [p for p in photo['points'] if p['use'] == 'camera' and p['visibility'] == 'visible']
    world = np.array([skeleton['points'][p['id']] for p in pts], dtype=np.float64)
    pixels = np.array([p['pixel'] for p in pts], dtype=np.float64)
    width, height = photo['imageWidth'], photo['imageHeight']
    # 假设 36 mm 对应原图宽；后期裁剪未知，所以对焦距做三个有界先验试验。
    exif_f = width * photo['exifFocalMm'] / 36
    candidates = []
    for factor in [.85, 1.0, 1.15]:
        f = exif_f * factor
        K = np.array([[f, 0, width/2], [0, f, height/2], [0, 0, 1]], dtype=np.float64)
        for method in [cv2.SOLVEPNP_SQPNP, cv2.SOLVEPNP_EPNP]:
            ok, rv, tv = cv2.solvePnP(world, pixels, K, None, flags=method)
            if not ok:
                continue
            rv, tv = cv2.solvePnPRefineLM(world, pixels, K, None, rv, tv)
            R = cv2.Rodrigues(rv)[0]
            position = (-R.T @ tv).reshape(3)
            depth = (R @ world.T + tv)[2]
            expected_side = -1 if photo['sourceId'] == 'P90549627' else 1
            if min(depth) <= 0 or position[2]*expected_side <= 0 or not 0.1 < position[1] < 4:
                continue
            projected = cv2.projectPoints(world, rv, tv, K, None)[0].reshape(-1, 2)
            errors = np.linalg.norm(projected-pixels, axis=1)
            rms = float(np.sqrt(np.mean(errors**2)))
            score = rms + abs(math.log(factor))*25
            candidates.append((score, rms, factor, R, position, projected, errors))
    if not candidates:
        raise RuntimeError(f"{photo['sourceId']} 无满足先验的候选，不能自动放行")
    _, rms, factor, R, position, projected, errors = min(candidates, key=lambda c: c[0])
    rotation = R.T @ np.diag([1., -1., -1.])  # OpenCV +Z 前/+Y 下 → Three -Z 前/+Y 上
    vector = cv2.Rodrigues(rotation)[0].reshape(3)
    angle = np.linalg.norm(vector)
    quat = np.r_[vector/angle*math.sin(angle/2), math.cos(angle/2)] if angle > 1e-12 else np.array([0,0,0,1.])
    camera = dict(sourceId=photo['sourceId'], position=position.tolist(), quaternion=quat.tolist(),
                  fovY=math.degrees(2*math.atan(height/(2*exif_f*factor))), imageWidth=width,
                  imageHeight=height, crop=dict(x=0,y=0,width=width,height=height), near=.05, far=200)
    records.append(camera)
    report = dict(sourceId=photo['sourceId'], status='approximate-initial-pose', pointCount=len(pts),
                  exifScale=factor, rmsPx=rms, medianPx=float(np.median(errors)),
                  maxPx=float(max(errors)), medianRoiPercent=float(np.median(errors)/photo['roi']['width']*100),
                  candidateRmsPx=[dict(factor=c[2],rms=c[1]) for c in candidates],
                  points=[dict(id=p['id'],projected=proj.tolist(),errorPx=float(err)) for p,proj,err in zip(pts,projected,errors)])
    reports.append(report)
    print(photo['sourceId'], 'RMS px', round(rms,3), 'position', np.round(position,3), 'focal prior',factor)

(DATA/'cameras.json').write_text(json.dumps(dict(schemaVersion=1,skeletonId=skeleton['id'],cameras=records),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'docs/research/bmw-g20/stage1-camera-report.json').write_text(json.dumps(dict(schemaVersion=1,opencvVersion=cv2.__version__,numpyVersion=np.__version__,note='在近似骨架假设下的拟合内残差；不是独立验证、轮廓精度或实车测量。',reports=reports),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
