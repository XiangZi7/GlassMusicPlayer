"""从公开 GeoNames ZIP 提取离线地名。用法与数据许可见 README 的天气章节。"""

import argparse
import json
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile


# 从本地归档逐行读取 GeoNames 的 UTF-8 制表符数据。
def records(archive, filename):
    with ZipFile(archive) as zipped, zipped.open(filename) as stream:
        for line in stream:
            yield line.decode("utf-8").rstrip("\r\n").split("\t")


# 保留当代中文正式用名，简体和标记为首选的名称优先。
def chinese_names(archives, ids):
    names = {}
    for region, archive in zip(("CN", "HK", "MO", "TW"), archives, strict=True):
        for row in records(archive, region + ".txt"):
            _, city_id, lang, name, preferred, short, colloquial, historic = row[:8]
            if city_id not in ids or historic or colloquial or not name:
                continue
            language = lang.lower()
            if language not in ("zh-cn", "zh-hans", "zh", "zh-tw", "zh-hant"):
                continue
            score = (language in ("zh-cn", "zh-hans"), bool(preferred), language == "zh", not short)
            if city_id not in names or score > names[city_id][0]:
                names[city_id] = (score, name)
    return names


# 按纬度分桶，运行时仅检查当前位置附近的三个桶。
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cities", type=Path)
    parser.add_argument("aliases", type=Path, nargs=4, metavar="ZIP")
    args = parser.parse_args()
    cities = [r for r in records(args.cities, "cities15000.txt") if r[7] in
              ("PPL", "PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLA5")]
    names = chinese_names(args.aliases, {r[0] for r in cities})
    buckets = defaultdict(list)
    for city_id, name, _, _, lat, lon, *_ in cities:
        latitude, longitude = round(float(lat), 3), round(float(lon), 3)
        display = names[city_id][1] if city_id in names else name
        buckets[int(latitude // 1)].append([latitude, longitude, display])
    output = Path(__file__).resolve().parents[1] / "src/assets/weather-cities.json"
    output.write_text(json.dumps(buckets, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(cities)} 个地名，{output.stat().st_size:,} 字节")


if __name__ == "__main__":
    main()
