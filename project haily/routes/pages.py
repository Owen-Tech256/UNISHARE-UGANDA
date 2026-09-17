from flask import Blueprint, render_template

pages_bp = Blueprint('pages', __name__)


POLICY_PAGES = {
    'terms': {
        'title': 'Terms of Service',
        'eyebrow': 'Using UniShare Nkumba',
        'intro': 'These terms support responsible access to the University academic resource repository.',
        'sections': [
            ('Eligibility and accounts', 'UniShare is for Nkumba University students, class representatives and authorised staff. Keep your account details accurate and never share your password.'),
            ('Acceptable use', 'Use the platform for learning, teaching and approved academic collaboration. Do not upload unlawful, abusive, misleading or malicious material, or attempt to bypass moderation and access controls.'),
            ('Content and moderation', 'You retain responsibility for material you submit. UniShare may review, restrict or remove content that breaches University rules, copyright or these terms.'),
            ('Availability and contact', 'The service may change as University systems are maintained. Questions about these terms can be directed to support@nkumbauniversity.ac.ug or +256 781957183.'),
        ],
    },
    'privacy': {
        'title': 'Privacy Policy',
        'eyebrow': 'Your information',
        'intro': 'This policy explains how UniShare handles information needed to provide a secure academic service for the Nkumba community.',
        'sections': [
            ('Information collected', 'We collect account details such as name, institutional email, student or staff identifier, school and role. We also store resource submissions, moderation actions and basic account activity.'),
            ('How information is used', 'Information is used to authenticate users, organise resources by school, moderate submissions, provide support and protect the platform from misuse.'),
            ('Sharing and retention', 'Access is limited to authorised University platform administrators and moderators where necessary for their duties. Records are retained only as long as needed for academic, operational and safeguarding purposes.'),
            ('Your choices', 'Contact support to request correction of inaccurate profile information or to ask a question about your data. Do not include a password in support requests.'),
        ],
    },
    'academic-integrity': {
        'title': 'Academic Integrity',
        'eyebrow': 'Learn honestly',
        'intro': 'UniShare supports Nkumba University teaching and learning standards. Resources are for study, revision and legitimate academic collaboration.',
        'sections': [
            ('Original work', 'Upload only material you created or are permitted to share. Credit lecturers, authors and other sources, and respect copyright and licence conditions.'),
            ('Responsible study', 'Use notes, slides and past papers to understand concepts and prepare your own work. Do not submit copied material as your own or use shared resources to facilitate examination misconduct.'),
            ('Reporting concerns', 'Use the report tools on resources to flag plagiarism, copyright concerns, inaccurate content or material that could compromise an assessment.'),
            ('University standards', 'UniShare does not replace Nkumba University academic regulations. Where a concern is serious, it may be referred to the appropriate University office for review.'),
        ],
    },
    'help': {
        'title': 'Help Center',
        'eyebrow': 'Support for UniShare',
        'intro': 'Find quick guidance for the most common UniShare tasks.',
        'sections': [
            ('Getting started', 'Register with your Nkumba institutional email, sign in with your student number or staff ID, then browse resources for your school.'),
            ('Uploading resources', 'Class representatives can upload approved academic materials. Add accurate course and lecturer details; every upload is reviewed before publication.'),
            ('Password recovery', 'Use Forgot Password on the sign-in page. Enter the account identifier and institutional email, then follow the one-hour reset link.'),
            ('Need more help?', 'Contact the UniShare support team at support@nkumbauniversity.ac.ug or call +256 781957183. Never send your password or reset link to anyone.'),
        ],
    },
}


@pages_bp.route('/<page_name>')
def information_page(page_name):
    page = POLICY_PAGES.get(page_name)
    if not page:
        from flask import abort
        abort(404)
    return render_template('information_page.html', page=page)