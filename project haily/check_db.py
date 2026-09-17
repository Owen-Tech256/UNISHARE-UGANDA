import sqlite3

conn = sqlite3.connect('unishare_nkumba.db')
cursor = conn.cursor()

print("\n" + "="*90)
print("STUDENTS & CLASS REPS:")
print("="*90)
cursor.execute("""
    SELECT u.full_name, u.student_number, u.role, s.school_name, u.school_id
    FROM users u 
    JOIN schools s ON u.school_id = s.school_id 
    WHERE u.role IN ('student', 'class_rep');
""")
for row in cursor.fetchall():
    print(f"Name: {row[0]:<20} | ID: {row[1]} | Role: {row[2]:<10} | School: {row[3]} (ID: {row[4]})")

print("\n" + "="*90)
print("ADMINS & MODERATORS (CHECK THE ONE YOU ARE LOGGED IN AS!):")
print("="*90)
cursor.execute("""
    SELECT u.full_name, u.staff_id, u.role, s.school_name, u.school_id
    FROM users u 
    JOIN schools s ON u.school_id = s.school_id 
    WHERE u.role IN ('admin', 'moderator');
""")
for row in cursor.fetchall():
    print(f"Name: {row[0]:<20} | Staff ID: {row[1]:<12} | Role: {row[2]:<10} | School: {row[3]} (ID: {row[4]})")
print("="*90 + "\n")

conn.close()