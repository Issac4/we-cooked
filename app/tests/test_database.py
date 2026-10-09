from database import DATABASE_URL, engine


def test_database_url_driver_dialect():
    """Verify that DATABASE_URL explicitly defines the psycopg2 driver dialect."""
    assert DATABASE_URL.startswith("postgresql+psycopg2://")
    assert engine.url.drivername == "postgresql+psycopg2"


def test_engine_dialect_is_psycopg2():
    """Verify that the SQLAlchemy engine driver and DBAPI module are explicitly psycopg2."""
    assert engine.dialect.name == "postgresql"
    assert engine.dialect.driver == "psycopg2"
    assert engine.dialect.dbapi.__name__ == "psycopg2"
