// Android-ийн дэвсгэрийн алхам тоолуур (foreground service + утасны алхам мэдрэгч).
// Апп хаалттай, утас халаасанд байхад ч өдөр бүрийн алхамыг тоолж, 15 минут тутам
// сервер рүү илгээнэ. iOS / вэб / Expo Go дээр native модуль байхгүй тул null.
import { requireOptionalNativeModule } from "expo";

export type BackgroundStepDay = { local_date: string; steps: number };

type AlkhaachStepsModule = {
  /** Утсанд алхам тоолох hardware мэдрэгч байгаа эсэх */
  isSupported(): boolean;
  isEnabled(): boolean;
  /** Асаана. ACTIVITY_RECOGNITION зөвшөөрөл өмнө нь авсан байх ёстой. */
  start(baseUrl: string | null, token: string | null): Promise<boolean>;
  stop(): Promise<void>;
  /** Асаалттай байх ёстой ч зогссон бол дахин эхлүүлнэ */
  ensureRunning(): Promise<boolean>;
  /** Сервер рүү илгээх сессийн токен (асаалттай үед л хадгална) */
  setAuth(token: string | null): Promise<void>;
  /** Сүүлийн 14 хоногоос алхамтай өдрүүд */
  getDays(): Promise<BackgroundStepDay[]>;
  /** Тухайн өдрийн тоог дор хаяж steps болгоно (хэзээ ч бууруулахгүй) */
  raiseDay(date: string, steps: number): Promise<void>;
};

export default requireOptionalNativeModule<AlkhaachStepsModule>("AlkhaachSteps");
