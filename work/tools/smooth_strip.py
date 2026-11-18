"""모션 띠 중간 칸 만들기(광학 흐름 보간).

칸 사이마다 k칸을 끼워 넣어 띠를 매끄럽게 한다. 원래 칸은 그대로 두고(i번째 원래 칸 → i*(k+1)번째),
반복 띠(--loop)는 마지막 칸 → 첫 칸 사이도 메운다. 장비 마스크 띠(--mask)는 그림 띠에서 구한 흐름을 그대로 써서
옷 색 칠하기 영역이 그림과 어긋나지 않게 한다.

python work/tools/smooth_strip.py 그림띠.webp 출력.webp [--k 3] [--loop] [--mask 마스크띠.webp 마스크출력.webp] [--sheet 확인용.png]
"""
import argparse

import cv2
import numpy as np
from PIL import Image

CELL_W, CELL_H = 280, 255


def cells(path):
    image = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32) / 255.0
    count = image.shape[1] // CELL_W
    return [image[:, i * CELL_W:(i + 1) * CELL_W].copy() for i in range(count)]


def guide(cell):
    # 흐름을 구할 회색 그림: 실루엣(알파)을 강조하고 안쪽 명암도 조금 넣는다
    alpha = cell[..., 3]
    luma = (cell[..., 0] * 0.299 + cell[..., 1] * 0.587 + cell[..., 2] * 0.114) * alpha
    return np.clip((alpha * 0.55 + luma * 0.45) * 255, 0, 255).astype(np.uint8)


def flow_between(a, b):
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    dis.setFinestScale(0)
    dis.setPatchSize(12)
    dis.setPatchStride(4)
    dis.setGradientDescentIterations(25)
    dis.setVariationalRefinementIterations(5)
    ga, gb = guide(a), guide(b)
    ab = dis.calc(ga, gb, None)
    ba = dis.calc(gb, ga, None)
    # 흐름을 부드럽게: 이웃 픽셀끼리 따로 놀면 그림이 찢어진 줄무늬가 생기므로, 늘어나는 쪽으로 다듬는다
    return smooth_flow(ab), smooth_flow(ba)


FLOW_BLUR = 7


def smooth_flow(flow):
    if FLOW_BLUR <= 0:
        return flow
    flow = cv2.medianBlur(flow, 5)
    return cv2.GaussianBlur(flow, (0, 0), FLOW_BLUR)


def warp(cell, flow, scale):
    h, w = cell.shape[:2]
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    mx = gx - flow[..., 0] * scale
    my = gy - flow[..., 1] * scale
    return cv2.remap(cell, mx, my, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def premul(cell):
    out = cell.copy()
    out[..., :3] *= out[..., 3:4]
    return out


def unpremul(cell):
    out = cell.copy()
    alpha = np.maximum(out[..., 3:4], 1e-4)
    out[..., :3] = np.where(out[..., 3:4] > 1e-4, out[..., :3] / alpha, 0)
    return np.clip(out, 0, 1)


def between(a, b, ab, ba, t, mode='near'):
    # 중간 시각 t의 그림. near = 가까운 원래 칸 하나만 흐름대로 휘어 쓴다(두 그림이 겹친 잔상이 없음).
    # blend = A를 t만큼, B를 (1-t)만큼 끌어와 섞는다(알파를 곱한 색으로)
    wa = warp(premul(a), ab, t)
    wb = warp(premul(b), ba, 1 - t)
    if mode == 'near':
        mixed = wa if t < 0.5 else wb
        return unpremul(mixed)
    mixed = wa * (1 - t) + wb * t
    # 실루엣은 더 또렷하게: 알파를 조금 세운다
    mixed[..., 3] = np.clip((mixed[..., 3] - 0.5) * 1.15 + 0.5, 0, 1) * (mixed[..., 3] > 0.02)
    return unpremul(mixed)


def between_mask(ma, mb, ab, ba, t):
    # 마스크는 섞지 않고 가까운 쪽을 고른다(칠할 부위 값이 섞이면 색이 틀어짐)
    wa = warp(ma, ab, t)
    wb = warp(mb, ba, 1 - t)
    return wa if t < 0.5 else wb


def smooth(frames, k, loop, masks=None, mode='near'):
    out, out_masks = [], []
    pairs = len(frames) if loop else len(frames) - 1
    for i in range(pairs):
        a, b = frames[i], frames[(i + 1) % len(frames)]
        ab, ba = flow_between(a, b)
        out.append(a)
        if masks is not None:
            out_masks.append(masks[i])
        for j in range(1, k + 1):
            t = j / (k + 1)
            out.append(between(a, b, ab, ba, t, mode))
            if masks is not None:
                out_masks.append(between_mask(masks[i], masks[(i + 1) % len(masks)], ab, ba, t))
    if not loop:
        out.append(frames[-1])
        if masks is not None:
            out_masks.append(masks[-1])
    return out, out_masks


def save(frames, path, lossless=False):
    # 마스크 띠는 칠할 부위 색(빨강·초록·파랑·노랑)이 뭉개지지 않게 손실 없이 저장한다
    strip = np.concatenate(frames, axis=1)
    image = Image.fromarray(np.clip(strip * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')
    if lossless:
        image.save(path, lossless=True, method=6)
    else:
        image.save(path, lossless=False, quality=90, method=6)


def sheet(frames, path, per_row=8):
    rows = []
    for start in range(0, len(frames), per_row):
        row = frames[start:start + per_row]
        row += [np.zeros_like(frames[0])] * (per_row - len(row))
        rows.append(np.concatenate(row, axis=1))
    image = np.concatenate(rows, axis=0)
    bg = np.ones_like(image[..., :3]) * np.array([0.93, 0.9, 0.85], dtype=np.float32)
    rgb = image[..., :3] * image[..., 3:4] + bg * (1 - image[..., 3:4])
    Image.fromarray(np.clip(rgb * 255, 0, 255).astype(np.uint8), 'RGB').save(path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('src')
    parser.add_argument('out')
    parser.add_argument('--k', type=int, default=3)
    parser.add_argument('--loop', action='store_true')
    parser.add_argument('--mask', nargs=2)
    parser.add_argument('--sheet')
    parser.add_argument('--mode', default='near', choices=['near', 'blend'])
    args = parser.parse_args()
    frames = cells(args.src)
    masks = cells(args.mask[0]) if args.mask else None
    result, result_masks = smooth(frames, args.k, args.loop, masks, args.mode)
    save(result, args.out)
    if args.mask:
        save(result_masks, args.mask[1], lossless=True)
    if args.sheet:
        sheet(result, args.sheet)
    print(f'{len(frames)} → {len(result)} frames')
