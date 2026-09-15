import { liveDelta, localDateStr, mergeIntoQueue } from "../stepMath";

describe("localDateStr", () => {
  it("сар/өдрийг 2 оронтой болгоно", () => {
    expect(localDateStr(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateStr(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("UTC биш, ОРОН НУТГИЙН огноог өгнө", () => {
    // 23:30 орон нутгийн цагаар — UTC руу шилжвэл маргаашийнх болох магадлалтай
    expect(localDateStr(new Date(2026, 5, 10, 23, 30))).toBe("2026-06-10");
  });
});

describe("liveDelta", () => {
  it("хуримтлалын зөрүүг өгнө", () => {
    expect(liveDelta(120, 100)).toBe(20);
  });

  it("тоолуур тэглэгдвэл бүхэл утгыг авна", () => {
    expect(liveDelta(5, 900)).toBe(5);
  });

  it("буруу утгыг 0 болгоно", () => {
    expect(liveDelta(NaN, 10)).toBe(0);
    expect(liveDelta(-5, 0)).toBe(0);
  });
});

describe("mergeIntoQueue", () => {
  it("шинэ өдрийг нэмнэ", () => {
    const q = mergeIntoQueue([], "2026-06-10", 4000);
    expect(q).toEqual([{ local_date: "2026-06-10", steps: 4000, source: "device" }]);
  });

  it("байгаа өдрийг зөвхөн ИХ утгаар шинэчилнэ", () => {
    const base = [{ local_date: "2026-06-10", steps: 7000, source: "device" }];
    expect(mergeIntoQueue(base, "2026-06-10", 3000)[0].steps).toBe(7000);
    expect(mergeIntoQueue(base, "2026-06-10", 9000)[0].steps).toBe(9000);
  });

  it("өөр өдрийн бичлэгийг хадгална", () => {
    const base = [{ local_date: "2026-06-09", steps: 5000, source: "manual" }];
    const q = mergeIntoQueue(base, "2026-06-10", 4000);
    expect(q).toHaveLength(2);
    expect(q.find((d) => d.local_date === "2026-06-09")?.steps).toBe(5000);
  });

  it("0 буюу сөрөг алхмыг үл тоомсорлоно", () => {
    expect(mergeIntoQueue([], "2026-06-10", 0)).toEqual([]);
  });
});
