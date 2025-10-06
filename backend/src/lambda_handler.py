"""
AWS Lambda handler using Mangum adapter.
"""

from mangum import Mangum
from src.main import app

handler = Mangum(app, lifespan="off")
