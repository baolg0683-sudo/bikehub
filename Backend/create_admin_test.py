import os
import bcrypt
from src.create_app import create_app

os.environ['DEFAULT_ADMIN_EMAIL'] = 'admin@bikehub.test'
os.environ['DEFAULT_ADMIN_PASSWORD'] = 'Admin123!'
os.environ['DEFAULT_ADMIN_PHONE'] = '0987654321'
os.environ['DEFAULT_ADMIN_NAME'] = 'BikeHub Admin'

app = create_app()
with app.app_context():
    from infrastructure.models.auth.user_model import UserModel
    from infrastructure.databases import db
    admin = db.session.query(UserModel).filter(UserModel.role == 'ADMIN').first()
    if admin:
        print('ADMIN_CREATED')
        print(admin.email)
        print(admin.phone)
    else:
        print('ADMIN_NOT_CREATED')
