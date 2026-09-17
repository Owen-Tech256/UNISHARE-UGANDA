from models import Resource, User


def can_user_access_resource(user, resource):
    """Check if user can access a specific resource."""
    if not resource or resource.is_deleted:
        return False
    # Coordinators can always see their own uploads; everyone else sees
    # approved resources (staff also see everything in practice via APIs).
    if user.role in ['student', 'coordinator']:
        if resource.status != 'approved':
            if user.role == 'coordinator' and resource.uploader_id == user.user_id:
                return True
            return False
    return True


def user_belongs_to_school(user, school_id):
    """Check if user belongs to a specific school."""
    return user.school_id == school_id


def can_moderate_resource(user, resource):
    """Check if a moderator can moderate a specific resource."""
    if user.role != 'moderator':
        return False
    return user.school_id == resource.school_id


def can_admin_resource(user, resource):
    """Check if a super admin can manage a specific resource."""
    if user.role != 'super_admin':
        return False
    return user.school_id == resource.school_id
