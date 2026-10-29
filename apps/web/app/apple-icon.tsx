import { ImageResponse } from "next/og";
import { BAMBII_LOGO_PATH, BAMBII_LOGO_VIEWBOX } from "@/components/bambii-logo";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

/** The home-screen icon: the white fawn on black. iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#000" }}>
      <svg height="136" viewBox={BAMBII_LOGO_VIEWBOX} width="136" xmlns="http://www.w3.org/2000/svg">
        <path d={BAMBII_LOGO_PATH} fill="#fff" fillRule="evenodd" />
      </svg>
    </div>,
    size,
  );
}
