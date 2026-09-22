"""accdb -> csv via the native Access ODBC driver (pyodbc). No mdbtools needed."""
import csv, os, sys
import pyodbc

DRV = "{Microsoft Access Driver (*.mdb, *.accdb)}"


def dump(accdb, outdir):
    os.makedirs(outdir, exist_ok=True)
    cn = pyodbc.connect(f"DRIVER={DRV};DBQ={os.path.abspath(accdb)};", autocommit=True)
    cur = cn.cursor()
    tables = [r.table_name for r in cur.tables(tableType="TABLE")]
    for t in tables:
        cur.execute(f'SELECT * FROM [{t}]')
        cols = [d[0] for d in cur.description]
        path = os.path.join(outdir, f"{t}.csv")
        n = 0
        with open(path, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(cols)
            for row in cur:
                w.writerow(["" if v is None else v for v in row])
                n += 1
        print(f"  {t:<40} {n:>8} rows -> {os.path.basename(path)}")
    cn.close()
    return tables


if __name__ == "__main__":
    for accdb, outdir in zip(sys.argv[1::2], sys.argv[2::2]):
        print(f"== {accdb}")
        dump(accdb, outdir)
