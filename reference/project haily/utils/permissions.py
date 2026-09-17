from models import Resource, User


def can_user_access_resource(user, resource):
    """Check if user can access a specific resource."""
    if not resource or resource.is_deleted:
        return False
    # Students/class_reps can only see approved resources (unless they're the uploader or staff)
    if user.role in ['student', 'class_rep']:
        if resource.status != 'approved':
            # Exception: class reps can see their own uploads
            if user.role == 'class_rep' and resource.uploader_id == user.user_id:
                return True
            return False
    return True


def user_belongs_to_school(user, school_id):
    """Check if user belongs to a specific school."""
    return user.school_id == school_id


def can_moderate_resource(moderator, resource):
    """Check if a moderator can moderate a specific resource."""
    if moderator.role != 'moderator':
        return False
    return moderator.school_id == resource.school_id


def can_admin_resource(admin, resource):
    """Check if an admin can manage a specific resource."""
    if admin.role != 'admin':
        return False
    return admin.school_id == resource.school_id