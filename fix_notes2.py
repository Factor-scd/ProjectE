import sys

with open(sys.argv[1], 'r') as f:
    content = f.read()

old = '<input\n                key={selectedNote?.id || \'none\'}\n                defaultValue={selectedNote?.title || \'\'}\n                onBlur={(e) => {'
new = '<input\n                key={selectedNote?.id || \'none\'}\n                defaultValue={selectedNote?.title || \'\'}\n                onMouseDown={(e) => e.stopPropagation()}\n                onBlur={(e) => {'

content = content.replace(old, new, 1)

with open(sys.argv[1], 'w') as f:
    f.write(content)
print('Done')
