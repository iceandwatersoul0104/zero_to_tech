from fastapi import FastAPI

app = FastAPI()

profile = {
    "heroTitle": "关于我",
    "heroSubtitle": "项目，创意，灵感，心得，我的作品",
}


@app.get("/api/profile")
def get_profile():
    return profile
