from sqlmodel import create_engine, Session
from config import settings

DATABASE_URL = f"postgresql://{settings.DB_USER}:{settings.DB_PASS}@{settings.DB_HOST}/{settings.DB_NAME}"

# The SQLAlchemy engine
engine = create_engine(DATABASE_URL, echo=False)

def get_session():
    """Dependency to provide a database session. 
    Handlers are responsible for calling session.commit().
    """
    with Session(engine) as session:
        yield session
