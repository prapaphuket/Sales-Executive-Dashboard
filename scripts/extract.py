# ดึงผลลัพธ์ query จากบันทึกการทำงาน (ผล MCP) -> JSON  usage: extract.py <marker> <out.json>
import sys, json, ast
marker, out = sys.argv[1], sys.argv[2]
src = '/root/.claude/projects/-home-claude/0d9a80ef-9345-5061-89ad-c00222148903.jsonl'
found = None
for line in open(src, encoding='utf-8'):
    if marker not in line: continue
    try: o = json.loads(line)
    except Exception: continue
    msg = o.get('message') or {}
    for c in (msg.get('content') or []) if isinstance(msg.get('content'), list) else []:
        if isinstance(c, dict) and c.get('type') == 'tool_result':
            txt = c.get('content')
            if isinstance(txt, list): txt = ''.join(x.get('text', '') for x in txt if isinstance(x, dict))
            if txt and marker in txt and txt.lstrip().startswith('[{'): found = txt
if not found: sys.exit('not found')
v = ast.literal_eval(found)
v = list(v[0].values())[0]
json.dump(v, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
print(out, len(json.dumps(v)))
