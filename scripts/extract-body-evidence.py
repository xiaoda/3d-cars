"""从已冻结的官方二维 PDF 复现 v0.3 参考点；不创建 / 修改原 PDF。

可选离线工具：需要 PyMuPDF（fitz），不参与 npm 构建。
曲线路径由人工目视选择，不能把此提取器当成通用车模重建器。
"""
from pathlib import Path
import hashlib
import json
import fitz

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "public/references/audi-a4-dimensions.pdf"
SHA = "4f733bff3c350f1a86aeb9f3e38a617d24cce9bc2275d0b4c9f73b70d451a429"
if hashlib.sha256(PDF.read_bytes()).hexdigest() != SHA:
    raise SystemExit("原 PDF 已改变，必须重新人工确认路径与标定，停止生成。")

document = fitz.open(PDF)
drawings = document[0].get_drawings()
# 与已冻结 side 标定相同；这不是新的一套可调整标定。
SCALE = (878.834 - 306.843) / 2.82
OX, OY = 607.442525531915, 969.96


def sample(item, n, include_end=False):
    if item[0] == "c":
        for j in range(n + int(include_end)):
            t = j / n
            q = [(1-t)**3, 3*(1-t)**2*t, 3*(1-t)*t*t, t**3]
            yield [sum(q[k]*item[k+1].x for k in range(4))*2,
                   sum(q[k]*item[k+1].y for k in range(4))*2]
    elif item[0] == "l":
        yield [item[1].x*2, item[1].y*2]
        if include_end:
            yield [item[2].x*2, item[2].y*2]


roof = []
for idx, selected in [(970, None), (972, [3, 4, 5]), (978, None)]:
    for k, item in enumerate(drawings[idx]["items"]):
        if selected is None or k in selected:
            roof.extend(sample(item, 60, True))
roof.sort()
samples = []
for x in [-1.05, -.86, -.63, -.34, -.14, .10, .28, .55, .8, 1.0, 1.13, 1.3, 1.48, 1.65, 1.8, 1.845]:
    px = OX + x*SCALE
    for a, b in zip(roof, roof[1:]):
        if a[0] <= px <= b[0] and b[0] > a[0]:
            py = a[1] + (b[1]-a[1])*(px-a[0])/(b[0]-a[0])
            samples.append([x, round((OY-py)/SCALE, 4)])
            break
outline = []
for item in drawings[1014]["items"]:
    for x, y in sample(item, 6):
        outline.append([round((x-OX)/SCALE, 5), round((OY-y)/SCALE, 5)])
data = {
    "source": f"Audi dimensions 04/19; frozen PDF SHA-256 {SHA}",
    "method": "Manually selected 2D PDF drawing paths, sampled and mapped with unchanged side-view calibration; not CAD, not measured 3D surface.",
    "roofPaths": [970, 972, 978], "windowPath": 1014,
    "roofSamples": samples, "sideWindowOutline": outline,
}
destination = ROOT / "src/data/bodyEvidence.json"
destination.write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
print(f"已提取 {len(samples)} 个纵向观察点和 {len(outline)} 个窗边界点；原始 PDF 未改动。")
