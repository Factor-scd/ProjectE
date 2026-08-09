import sys

with open(sys.argv[1], 'r') as f:
    content = f.read()

old = 'className=flex h-9 w-full rounded-md border-0 bg-transparent px-0 py-1 text-lg font-semibold text-base shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50'
new = 'className="flex h-9 w-full rounded-md border-0 bg-transparent px-0 py-1 text-lg font-semibold text-base shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"'

count = content.count(old)
print(f'Found {count} occurrences')

content = content.replace(old, new, 1)

with open(sys.argv[1], 'w') as f:
    f.write(content)
print('Done')
