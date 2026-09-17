import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates')
ADMIN_DIR = os.path.join(TEMPLATES_DIR, 'admin')

print("=" * 60)
print("🔍 UniShare Nkumba - Template Diagnostic Tool")
print("=" * 60)
print(f"\n📁 Project root: {BASE_DIR}")
print(f"📁 Templates dir: {TEMPLATES_DIR}")

# Check templates folder
if not os.path.exists(TEMPLATES_DIR):
    print(f"\n❌ ERROR: 'templates' folder does NOT exist!")
    print(f"   Expected at: {TEMPLATES_DIR}")
    print(f"   Please create it manually.")
else:
    print(f"\n✅ 'templates' folder exists.")
    print(f"\n📂 Contents of templates/:")
    for item in sorted(os.listdir(TEMPLATES_DIR)):
        full_path = os.path.join(TEMPLATES_DIR, item)
        if os.path.isdir(full_path):
            print(f"   📁 {item}/")
        else:
            print(f"   📄 {item}")

# Check admin folder
print(f"\n📁 Admin dir: {ADMIN_DIR}")
if not os.path.exists(ADMIN_DIR):
    print(f"\n❌ ERROR: 'admin' subfolder does NOT exist inside templates!")
    print(f"   Creating it now...")
    os.makedirs(ADMIN_DIR, exist_ok=True)
    print(f"   ✅ Created: {ADMIN_DIR}")
else:
    print(f"\n✅ 'admin' folder exists.")
    print(f"\n📂 Contents of templates/admin/:")
    items = os.listdir(ADMIN_DIR)
    if not items:
        print(f"   ⚠️  Folder is EMPTY!")
    else:
        for item in sorted(items):
            full_path = os.path.join(ADMIN_DIR, item)
            size = os.path.getsize(full_path)
            print(f"   📄 {item} ({size} bytes)")

# Check for the specific file
REQUIRED_FILES = [
    'moderation_queue.html',
    'reports.html',
    'users.html'
]

print(f"\n🔎 Checking required admin templates:")
for filename in REQUIRED_FILES:
    filepath = os.path.join(ADMIN_DIR, filename)
    if os.path.exists(filepath):
        size = os.path.getsize(filepath)
        if size == 0:
            print(f"   ⚠️  {filename} exists but is EMPTY ({size} bytes)")
        else:
            print(f"   ✅ {filename} ({size} bytes)")
    else:
        # Check for common Windows mistakes
        possible_wrong_names = [
            filename + '.txt',
            filename + '.html.txt',
            filename.replace('_', '-'),
            filename.upper(),
        ]
        print(f"   ❌ {filename} NOT FOUND")
        for wrong in possible_wrong_names:
            wrong_path = os.path.join(ADMIN_DIR, wrong)
            if os.path.exists(wrong_path):
                print(f"      💡 Found similar file: '{wrong}' — This is likely the problem!")
                print(f"         Windows may be hiding the .txt extension.")
                print(f"         Rename it to exactly: {filename}")

print("\n" + "=" * 60)