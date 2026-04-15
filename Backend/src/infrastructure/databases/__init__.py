from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

db = SQLAlchemy()
Base = declarative_base(metadata=db.metadata)
SessionLocal = sessionmaker()

def init_db(app):
    db.init_app(app)
    with app.app_context():
        db.create_all()
        SessionLocal.configure(bind=db.engine)