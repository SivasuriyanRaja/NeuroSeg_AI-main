import os
import logging
from mongoengine import connect

log = logging.getLogger("neuroseg.db")

def init_db():
    mongo_uri = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")
    if mongo_uri:
        log.info("Connecting to MongoDB via URI...")
        connect(host=mongo_uri)
    else:
        try:
            import mongomock
            log.info("Connecting to in-memory mongomock database...")
            connect('neuroseg', host='localhost', mongo_client_class=mongomock.MongoClient)
        except ImportError:
            log.warning("mongomock not installed, attempting standard mongoengine connect on localhost...")
            connect('neuroseg', host='localhost')

def get_db():
    yield None

