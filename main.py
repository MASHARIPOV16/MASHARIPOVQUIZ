import os
import uvicorn
from config import HOST, PORT

if __name__ == "__main__":
    # Railway passes the PORT dynamically via environment variable
    port = int(os.getenv("PORT", PORT))
    host = os.getenv("HOST", HOST)
    is_dev = os.getenv("ENV", "production").lower() == "development"

    print(f"🚀 Quiz WebApp server ishga tushmoqda: http://{host}:{port} (Dev: {is_dev})")
    uvicorn.run("server:app", host=host, port=port, reload=is_dev)
