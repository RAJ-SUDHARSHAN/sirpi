from mangum import Mangum
from src.main import app

# Lambda handler - strip /prod stage from path
handler = Mangum(app, lifespan="off", api_gateway_base_path="/prod")
