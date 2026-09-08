#!/usr/bin/env python3
"""Inspect Meta Messenger conversation metadata and optionally take one thread.

Required environment variables:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Usage:
  python tools/check_thread_control.py --page-id 1032290633303246
  python tools/check_thread_control.py --page-id 1032290633303246 --take-thread t_1055015197339605

The script never sends a customer message. --take-thread changes thread ownership,
so use it only when explicitly intended.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request


def get_json(url, headers=None, method="GET", payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.status, json.loads(response.read().decode() or "{}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--page-id", required=True)
    parser.add_argument("--take-thread")
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()

    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not service_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    query = urllib.parse.urlencode({"select": "page_id,page_name,access_token", "page_id": f"eq.{args.page_id}", "limit": "1"})
    status, rows = get_json(f"{base}/rest/v1/page_tokens_vault?{query}", headers=headers)
    if status != 200 or not rows or not rows[0].get("access_token"):
        raise SystemExit("No usable page token found in page_tokens_vault")
    token = rows[0]["access_token"]

    fields = "id,updated_time,message_count,participants,can_reply"
    graph_query = urllib.parse.urlencode({"fields": fields, "limit": str(args.limit), "access_token": token})
    graph_status, body = get_json(f"https://graph.facebook.com/v26.0/{args.page_id}/conversations?{graph_query}")
    if graph_status != 200:
        raise SystemExit(json.dumps({"graph_status": graph_status, "error": body.get("error")}, ensure_ascii=False))

    threads = []
    for conversation in body.get("data", []):
        participants = conversation.get("participants", {}).get("data", [])
        customer_ids = [str(p.get("id")) for p in participants if str(p.get("id")) != str(args.page_id)]
        threads.append({
            "thread_id": conversation.get("id"),
            "updated_time": conversation.get("updated_time"),
            "message_count": conversation.get("message_count"),
            "can_reply": conversation.get("can_reply"),
            "customer_psids": customer_ids,
            "control_owner": "not exposed by conversations endpoint",
        })

    result = {"page_id": args.page_id, "page_name": rows[0].get("page_name"), "thread_count": len(threads), "threads": threads}

    if args.take_thread:
        target = next((thread for thread in threads if thread["thread_id"] == args.take_thread), None)
        if not target or not target["customer_psids"]:
            raise SystemExit(json.dumps({"error": "Thread not found or no customer PSID", "thread_id": args.take_thread}, ensure_ascii=False))
        endpoint = f"https://graph.facebook.com/v26.0/{args.page_id}/take_thread_control"
        payload = {"recipient": {"id": target["customer_psids"][0]}, "access_token": token}
        try:
            take_status, take_body = get_json(endpoint, method="POST", payload=payload)
            result["take_thread_control"] = {"http_status": take_status, "response": take_body}
        except urllib.error.HTTPError as error:
            error_body = error.read().decode(errors="replace")
            try:
                error_body = json.loads(error_body)
            except json.JSONDecodeError:
                pass
            result["take_thread_control"] = {"http_status": error.code, "response": error_body}

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
