import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueue = vi.fn(async () => {});
vi.mock("@/lib/offline/queue", () => ({ enqueue }));

const { queued, queuedForm } = await import("@/lib/offline/wrap");

function setOnline(value: boolean) {
  vi.stubGlobal("navigator", { onLine: value });
}

beforeEach(() => {
  enqueue.mockClear();
  setOnline(true);
});

describe("offline queue wrapper", () => {
  it("passes a server answer straight through", async () => {
    const action = vi.fn(async () => ({ ok: false as const, error: "Số tiền phải lớn hơn 0." }));
    const result = await queued("saveTransaction", "Giao dịch", action)({ amount: 0 });
    // The server rejected it, so queueing would only replay the same rejection.
    expect(result).toEqual({ ok: false, error: "Số tiền phải lớn hơn 0." });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("queues a write whose request never left the device", async () => {
    const action = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await queued("saveTransaction", "Giao dịch", action)({ amount: 50000 });
    expect(result).toEqual({ ok: true, data: null, queued: true });
    expect(enqueue).toHaveBeenCalledWith({ name: "saveTransaction", label: "Giao dịch", payload: { amount: 50000 } });
  });

  it("queues anything that fails while the device is offline", async () => {
    setOnline(false);
    const action = vi.fn(async () => {
      throw new Error("NetworkError");
    });
    expect(await queued("saveDebt", "Khoản nợ", action)({ id: "x" })).toMatchObject({ queued: true });
    expect(enqueue).toHaveBeenCalledOnce();
  });

  it("does not swallow a real bug", async () => {
    const action = vi.fn(async () => {
      throw new RangeError("boom");
    });
    await expect(queued("saveWallet", "Ví", action)({})).rejects.toThrow("boom");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("keeps the photo with the form fields it belongs to", async () => {
    const form = new FormData();
    form.set("studentId", "s1");
    form.set("clientRequestId", "req-1");
    form.set("photo", new File([new Uint8Array([1, 2, 3])], "photo.webp", { type: "image/webp" }));
    const action = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    await queuedForm("checkIn", "Check-in", action)(form);

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "checkIn",
        payload: { studentId: "s1", clientRequestId: "req-1" },
        fileName: "photo.webp",
        file: expect.any(File),
      }),
    );
  });
});
