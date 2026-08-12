"""角色 CRUD API 集成测试。"""


def _create_project(auth_client, name: str = "默认项目") -> dict:
    """创建一个项目并返回响应 data。"""
    return auth_client.post(
        "/projects",
        json={
            "project_name": name,
            "character_perspective": 1,
            "directional_movement": 2,
            "sprite_width": 64,
            "sprite_height": 64,
        },
    ).json()["data"]


def _payload(project_id: int, **overrides):
    """构造合法的创建角色请求体。"""
    base = {
        "project_id": project_id,
        "workflow_run_id": 1,
        "name": "勇者",
        "description": "主角",
    }
    base.update(overrides)
    return base


# -- POST /characters --------------------------------------------------------


def test_create_with_name(auth_client):
    project = _create_project(auth_client)
    resp = auth_client.post("/characters", json=_payload(project["id"]))

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    assert body["data"]["name"] == "勇者"
    assert body["data"]["description"] == "主角"
    assert body["data"]["project_id"] == project["id"]
    assert body["data"]["status"] == 0


def test_create_without_name(auth_client):
    project = _create_project(auth_client)
    resp = auth_client.post("/characters", json=_payload(project["id"], name=None))

    assert resp.json()["code"] == 200
    assert resp.json()["data"]["name"] is None


def test_create_name_roundtrip(auth_client):
    """名称持久化后可通过 GET 读回。"""
    project = _create_project(auth_client)
    created = auth_client.post(
        "/characters",
        json=_payload(project["id"], name="小精灵"),
    ).json()["data"]

    resp = auth_client.get(f"/characters/{created['id']}")
    assert resp.json()["data"]["name"] == "小精灵"


def test_list_filters_published_characters_before_pagination(auth_client):
    project = _create_project(auth_client)
    draft = auth_client.post(
        "/characters",
        json=_payload(project["id"], name="草稿"),
    ).json()["data"]
    published = auth_client.post(
        "/characters",
        json=_payload(project["id"], name="已发布"),
    ).json()["data"]
    character_data = {
        "version": 1,
        "outfits": [
            {
                "id": "outfit-default",
                "name": "常态造型",
                "actions": [
                    {
                        "id": "idle",
                        "type": "idle",
                        "name": "待机",
                        "loop": True,
                        "fps": 8,
                        "frame_count": 1,
                        "frames": [
                            {
                                "index": 0,
                                "image_url": "https://cdn.windup.test/idle.png",
                            }
                        ],
                    }
                ],
            }
        ],
    }

    update_resp = auth_client.patch(
        f"/characters/{published['id']}",
        json={"character_data": character_data},
    )
    resp = auth_client.get(
        "/characters",
        params={"project_id": project["id"], "status": 1, "page": 1, "page_size": 1},
    )

    assert update_resp.json()["data"]["status"] == 1
    assert resp.json()["total"] == 1
    assert [item["id"] for item in resp.json()["data"]] == [published["id"]]
    assert draft["status"] == 0

    draft_resp = auth_client.get(
        "/characters",
        params={"project_id": project["id"], "status": 0},
    )
    assert draft_resp.json()["total"] == 1
    assert [item["id"] for item in draft_resp.json()["data"]] == [draft["id"]]


# -- 跨用户权限校验 -------------------------------------------------------------


def test_create_under_other_users_project_returns_404(auth_client, auth_client_b):
    """用户 B 不能在用户 A 的项目下创建角色。"""
    project = _create_project(auth_client)
    resp = auth_client_b.post("/characters", json=_payload(project["id"]))

    assert resp.json()["code"] == 404
    assert resp.json()["message"] == "项目不存在"


def test_list_other_users_project_characters_returns_404(auth_client, auth_client_b):
    """用户 B 不能列出用户 A 项目下的角色。"""
    project = _create_project(auth_client)
    auth_client.post("/characters", json=_payload(project["id"]))

    resp = auth_client_b.get("/characters", params={"project_id": project["id"]})

    assert resp.json()["code"] == 404
    assert resp.json()["message"] == "项目不存在"


def test_get_other_users_character_returns_404(auth_client, auth_client_b):
    """用户 B 不能查看用户 A 的角色。"""
    project = _create_project(auth_client)
    created = auth_client.post(
        "/characters",
        json=_payload(project["id"]),
    ).json()["data"]

    resp = auth_client_b.get(f"/characters/{created['id']}")

    assert resp.json()["code"] == 404
    assert resp.json()["message"] == "角色不存在"


def test_update_other_users_character_returns_404(auth_client, auth_client_b):
    """用户 B 不能修改用户 A 的角色。"""
    project = _create_project(auth_client)
    created = auth_client.post(
        "/characters",
        json=_payload(project["id"]),
    ).json()["data"]

    resp = auth_client_b.patch(
        f"/characters/{created['id']}",
        json={"name": "黑化"},
    )

    assert resp.json()["code"] == 404
    assert resp.json()["message"] == "角色不存在"


def test_delete_other_users_character_returns_404(auth_client, auth_client_b):
    """用户 B 不能删除用户 A 的角色。"""
    project = _create_project(auth_client)
    created = auth_client.post(
        "/characters",
        json=_payload(project["id"]),
    ).json()["data"]

    resp = auth_client_b.delete(f"/characters/{created['id']}")

    assert resp.json()["code"] == 404
    assert resp.json()["message"] == "角色不存在"
