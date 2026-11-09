import sys,re
s=open(sys.argv[1]).read()
s=re.sub(r'--[^\n]*','',s)
s=s.replace('$1',"date '2024-11-01'").replace('$2',"date '2026-11-03'")
s=re.sub(r'\s+',' ',s).strip()
print(s)
