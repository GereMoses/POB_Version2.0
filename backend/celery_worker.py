"""
Celery Worker Configuration for Mustering System
"""

from celery import Celery
from app.services.mustering_celery_tasks import celery_app

# Configure Celery worker
app = celery_app

if __name__ == '__main__':
    app.start()
