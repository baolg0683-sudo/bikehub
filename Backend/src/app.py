import os
import logging
from dotenv import load_dotenv
from create_app import create_app

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = create_app()

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "9999"))
    logger.info(f"Server starting on http://{host}:{port}")
    app.run(host=host, port=port, debug=True)

