"""从冻结 PDF 中人工确认的门框/风挡路径采样；二维约束，不是三维 CAD。需 PyMuPDF。"""
from pathlib import Path
import hashlib
import json
import fitz

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / 'public/references/audi-a4-dimensions.pdf'
SHA = '4f733bff3c350f1a86aeb9f3e38a617d24cce9bc2275d0b4c9f73b70d451a429'
if hashlib.sha256(PDF.read_bytes()).hexdigest() != SHA:
    raise SystemExit('原 PDF 已变化，停止；需要重新人工确认路径。')
doc = fitz.open(PDF)
drawings = doc[0].get_drawings()

def points(index, start=0):
    result = []
    for item in drawings[index]['items'][start:]:
        if item[0] == 'c':
            for j in range(13):
                t = j / 12
                w = [(1-t)**3, 3*(1-t)**2*t, 3*(1-t)*t*t, t**3]
                result.append([sum(w[k]*item[k+1].x for k in range(4))*2,
                               sum(w[k]*item[k+1].y for k in range(4))*2])
        elif item[0] == 'l':
            result.extend([[p.x*2, p.y*2] for p in item[1:3]])
    return result

scale = (878.834-306.843)/2.82
side = lambda p: [round((p[0]-607.442525531915)/scale, 6), round((969.96-p[1])/scale, 6)]
data = {
    'source': 'Audi dimensions 04/19; manual path selection, not measured 3D surface',
    'pdfSha256': SHA,
    'method': 'Fixed original side calibration. Door curves sampled at 12 intervals per Bezier; windshield paths retained as pixel observations in top view.',
    'doorPaths': [{'paths': [951, 950], 'path950StartItem': 2}, {'paths': [1011]}],
    'doors': [list(map(side, points(951)+points(950, 2))), list(map(side, points(1011)))],
    'windshieldTopViewPaths': [1665, 1667, 1668],
    'windshieldTopViewPixels': {str(i): [[round(x, 3), round(y, 3)] for x, y in points(i)] for i in [1665, 1667, 1668]},
}
(ROOT/'src/data/cabinEvidence.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('已复现门框与俯视风挡二维观察点；未修改原始资料。')
