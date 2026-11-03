"""Ubah spreadsheet skuad (format superleague_pemain.xlsx, sheet "Detail") menjadi data/skuad.csv.

Pemakaian (dari folder root proyek):
    python3 -I desain/skrip/impor_skuad.py path/ke/superleague_pemain.xlsx

Kolom yang dibaca dari sheet "Detail":
    club_id | pemain | posisi | negara (Goal.com) | keterangan | catatan
- club_id boleh nama klub bebas ("Persib Bandung", "Persik", "Java United F.C."): dicocokkan ke id di data/klub.csv
- catatan "Dipinjam dari X"   -> pemain pinjaman yang MASUK (tetap tampil di skuad, diberi label)
- catatan "Dipinjamkan ke X"  -> pemain yang sedang DIPINJAMKAN keluar (tampil di grup terpisah)
Butuh: pip install openpyxl
"""
import csv, os, re, sys, unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

try:
    import openpyxl
except ImportError:
    sys.exit("Butuh openpyxl: pip install openpyxl")

if len(sys.argv) < 2:
    sys.exit(__doc__)


def kunci(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(re.sub(r"\b(fc|f c)\b", " ", s).split())


with open(os.path.join(ROOT, "data", "klub.csv"), newline="", encoding="utf-8-sig") as f:
    klub = list(csv.DictReader(f))
alias = {}
for k in klub:
    for nama in (k["id"], k["club"], k["short"]):
        alias[kunci(nama)] = k["id"]
# nama lain yang dipakai sumber
alias.update({kunci("Dewa United"): "dewa", kunci("Borneo Samarinda"): "borneo", kunci("Persita"): "persita",
              kunci("Persik"): "persik", kunci("Java United"): "java", kunci("Isenmulang Kalteng"): "isenmulang",
              kunci("Bhayangkara Presisi Lampung"): "bhayangkara", kunci("Arema"): "arema"})

wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
ws = wb["Detail"] if "Detail" in wb.sheetnames else wb.worksheets[0]
rows = list(ws.iter_rows(values_only=True))
head = [str(h or "").strip().lower() for h in rows[0]]
col = lambda *names: next((i for i, h in enumerate(head) if any(h.startswith(n) for n in names)), None)
iK, iP, iPos, iN, iKet, iCat = col("club"), col("pemain"), col("posisi"), col("negara"), col("keterangan"), col("catatan")

out, tak_kenal = [], set()
for r in rows[1:]:
    if not r or not r[iP] or not r[iK]:
        continue
    cid = alias.get(kunci(r[iK]))
    if not cid:
        tak_kenal.add(r[iK]); continue
    out.append({
        "club_id": cid,
        "pemain": str(r[iP]).strip(),
        "posisi": str(r[iPos] or "").strip(),
        "negara": str(r[iN] or "").strip() if iN is not None else "",
        "status": str(r[iKet] or "").strip().lower() if iKet is not None else "",
        "catatan": str(r[iCat] or "").strip() if iCat is not None else "",
    })

if tak_kenal:
    sys.exit("Nama klub tidak dikenal (tambahkan ke alias di skrip ini): " + ", ".join(sorted(map(str, tak_kenal))))

with open(os.path.join(ROOT, "data", "skuad.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["club_id", "pemain", "posisi", "negara", "status", "catatan"])
    w.writeheader(); w.writerows(out)
print(f"OK: data/skuad.csv · {len(out)} pemain · {len({o['club_id'] for o in out})} klub")
print("Lanjutkan dengan: python3 desain/skrip/prep.py")
