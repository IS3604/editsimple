// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SlideCanvas, type CanvasSlide } from "@/components/slide-canvas";
import { defaultDesign } from "@/lib/themes";
import { SLIDE_KINDS, TEMPLATES } from "@/lib/types";

afterEach(cleanup);

const base: CanvasSlide = { id: "s", kind: "statement", role: "x", kicker: "Your right", heading: "You can ask for your records", body: "Clinics must share them on request.", layout: "top", style: {}, background_path: null };

const renderSlide = (slide: Partial<CanvasSlide>, extra: Partial<Parameters<typeof SlideCanvas>[0]> = {}) =>
  render(<SlideCanvas slide={{ ...base, ...slide }} design={{ ...defaultDesign(), name: "Dr. Lee" }} size="1080x1350" index={1} total={5} bgUrl={null} logoUrl={null} {...extra} />);

describe("SlideCanvas", () => {
  it("renders at native export size", () => {
    const { container } = renderSlide({});
    const root = container.firstChild as HTMLElement;
    expect(root.style.width).toBe("1080px");
    expect(root.style.height).toBe("1350px");
  });

  it("renders every slide kind in every template without crashing", () => {
    for (const template of TEMPLATES)
      for (const kind of SLIDE_KINDS) {
        const { getByText, unmount } = render(
          <SlideCanvas slide={{ ...base, kind, items: [{ title: "Myth", text: "a" }, { title: "Fact", text: "b" }] }} design={defaultDesign(template)} size="1080x1080" index={0} total={1} bgUrl={null} logoUrl={null} />
        );
        expect(getByText("You can ask for your records")).toBeTruthy();
        unmount();
      }
  });

  it("shows the page counter and the client's name", () => {
    const { getByText } = renderSlide({});
    expect(getByText("2/5")).toBeTruthy();
    expect(getByText("Dr. Lee")).toBeTruthy();
  });

  it("labels myth and fact panels", () => {
    const { getByText } = renderSlide({ kind: "myth_fact", items: [{ title: "Myth", text: "Sunscreen is only for summer." }, { title: "Fact", text: "UV reaches you year-round." }] });
    expect(getByText("Myth")).toBeTruthy();
    expect(getByText("UV reaches you year-round.")).toBeTruthy();
  });

  it("splits comparison columns into lines", () => {
    const { getByText } = renderSlide({ kind: "comparison", items: [{ title: "Do", text: "Keep receipts\nTake photos" }, { title: "Don't", text: "Sign blank pages" }] });
    expect(getByText("Keep receipts")).toBeTruthy();
    expect(getByText("Take photos")).toBeTruthy();
    expect(getByText("Sign blank pages")).toBeTruthy();
  });

  it("puts the disclaimer on the closing slide", () => {
    const { getByText } = render(
      <SlideCanvas slide={{ ...base, kind: "cta" }} design={defaultDesign()} size="1080x1350" index={4} total={5} bgUrl={null} logoUrl={null} disclaimer="General information only, not legal advice." />
    );
    expect(getByText("General information only, not legal advice.")).toBeTruthy();
  });

  it("draws an imported branded background under the slide", () => {
    const { container } = render(
      <SlideCanvas slide={base} design={{ ...defaultDesign(), bgPath: "user/uploads/bg.png" }} size="1080x1350" index={0} total={3} bgUrl={null} logoUrl={null} />
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/api/assets?path=user%2Fuploads%2Fbg.png");
  });

  it("supports a single-slide post (no swipe cue on the last slide)", () => {
    const { queryByText } = render(<SlideCanvas slide={base} design={defaultDesign()} size="1080x1350" index={0} total={1} bgUrl={null} logoUrl={null} />);
    expect(queryByText("1/1")).toBeTruthy();
    expect(queryByText("Swipe")).toBeNull();
  });
});
