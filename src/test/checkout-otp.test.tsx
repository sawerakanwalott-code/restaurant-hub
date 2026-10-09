import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LuxuryOtpWidget } from "@/components/kennedy/LuxuryOtpWidget";

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

const requests = vi.hoisted(() => ({
  send: vi.fn().mockResolvedValue({ channel: "whatsapp", sent_via_whatsapp: true }),
  verify: vi.fn().mockResolvedValue({ account: { name: "Customer" } }),
}));
vi.mock("@/lib/auth", () => ({
  fetchPhoneOtpConfig: async () => ({ whatsapp_connected: true, default_channel: "whatsapp", channels: ["whatsapp", "sms"] }),
  requestPhoneCode: requests.send,
  verifyPhoneCode: requests.verify,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Compact checkout phone verification", () => {
  it("shows code entry on send and replaces it with a locked confirmation after verification", async () => {
    function Checkout() {
      const [verified, setVerified] = useState(false);
      return <><input aria-label="Phone" value="03001234567" readOnly disabled={verified} /><LuxuryOtpWidget phone="03001234567" name="Customer" isVerified={verified} onVerified={() => setVerified(true)} /></>;
    }
    render(<Checkout />);
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    const code = await screen.findByRole("textbox", { name: "Six digit verification code" });
    fireEvent.change(code, { target: { value: "123456" } });
    await waitFor(() => expect(requests.verify).toHaveBeenCalled());
    expect(await screen.findByText("Phone verified")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Phone" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Send code" })).not.toBeInTheDocument();
  });

  it("keeps both delivery methods available without duplicating resend controls", async () => {
    render(<LuxuryOtpWidget phone="03001234567" isVerified={false} onVerified={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "SMS" }));
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(requests.send).toHaveBeenCalledWith(expect.any(String), "sms"));
    expect(await screen.findByRole("button", { name: "Resend code" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Resend/ })).toHaveLength(1);
  });
});