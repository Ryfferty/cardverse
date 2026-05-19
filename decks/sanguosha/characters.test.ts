import { describe, it, expect } from "vitest";
import { caoCaoJueji } from "./effects/caocao.js";
import { liuBeiRende } from "./effects/liubei.js";
import { sunQuanZhiheng } from "./effects/sunquan.js";
import { guanYuWuSheng } from "./effects/guanyu.js";
import { zhangFeiBaqi } from "./effects/zhangfei.js";
import { zhaoYunLongDan } from "./effects/zhaoyun.js";
import { lvBuWuShuang } from "./effects/lvbu.js";
import { diaoChanLiJian, diaoChanBiYue } from "./effects/diaochan.js";
import { huaTuoQingNang, huaTuoJiJiu } from "./effects/huatuo.js";
import { simaYiFanKui, simaYiGuiCai } from "./effects/simayi.js";

describe("Sanguosha Characters — Wei Faction", () => {
  it("caocao jueji should have correct structure", () => {
    expect(caoCaoJueji.id).toBe("jueji");
    expect(caoCaoJueji.name).toBe("奸雄");
    expect(caoCaoJueji.type).toBe("passive");
    expect(typeof caoCaoJueji.script).toBe("string");
    expect(caoCaoJueji.trigger).toBe("onDamageReceived");
    expect(caoCaoJueji.validTargets).toBe("self");
  });

  it("simayi fankui should have correct structure", () => {
    expect(simaYiFanKui.id).toBe("fankui");
    expect(simaYiFanKui.name).toBe("反馈");
    expect(simaYiFanKui.type).toBe("passive");
    expect(typeof simaYiFanKui.script).toBe("string");
    expect(simaYiFanKui.trigger).toBe("onDamageReceived");
    expect(simaYiFanKui.validTargets).toBe("self");
  });

  it("simayi guicai should have correct structure", () => {
    expect(simaYiGuiCai.id).toBe("guicai");
    expect(simaYiGuiCai.name).toBe("鬼才");
    expect(simaYiGuiCai.type).toBe("active");
    expect(typeof simaYiGuiCai.script).toBe("string");
    expect(simaYiGuiCai.script).toContain("replace_judge_card");
    expect(simaYiGuiCai.trigger).toBe("beforeJudge");
    expect(simaYiGuiCai.validTargets).toBe("self");
  });
});

describe("Sanguosha Characters — Shu Faction", () => {
  it("liubei rende should have correct structure", () => {
    expect(liuBeiRende.id).toBe("rende");
    expect(liuBeiRende.name).toBe("仁德");
    expect(liuBeiRende.type).toBe("active");
    expect(typeof liuBeiRende.script).toBe("string");
    expect(liuBeiRende.trigger).toBe("playPhase");
    expect(liuBeiRende.validTargets).toBe("allOthers");
  });

  it("guanyu wusheng should have correct structure", () => {
    expect(guanYuWuSheng.id).toBe("wusheng");
    expect(guanYuWuSheng.name).toBe("武圣");
    expect(guanYuWuSheng.type).toBe("passive");
    expect(typeof guanYuWuSheng.script).toBe("string");
    expect(guanYuWuSheng.trigger).toBe("playSha");
    expect(guanYuWuSheng.validTargets).toBe("self");
  });

  it("zhangfei baqi should have correct structure", () => {
    expect(zhangFeiBaqi.id).toBe("baqi");
    expect(zhangFeiBaqi.name).toBe("咆哮");
    expect(zhangFeiBaqi.type).toBe("passive");
    expect(typeof zhangFeiBaqi.script).toBe("string");
    expect(zhangFeiBaqi.script).toContain("unlimited_sha");
    expect(zhangFeiBaqi.trigger).toBe("playSha");
    expect(zhangFeiBaqi.validTargets).toBe("self");
  });

  it("zhaoyun longdan should have correct structure", () => {
    expect(zhaoYunLongDan.id).toBe("longdan");
    expect(zhaoYunLongDan.name).toBe("龙胆");
    expect(zhaoYunLongDan.type).toBe("passive");
    expect(typeof zhaoYunLongDan.script).toBe("string");
    expect(zhaoYunLongDan.trigger).toBe("playShaOrShan");
    expect(zhaoYunLongDan.validTargets).toBe("self");
  });
});

describe("Sanguosha Characters — Wu Faction", () => {
  it("sunquan zhiheng should have correct structure", () => {
    expect(sunQuanZhiheng.id).toBe("zhiheng");
    expect(sunQuanZhiheng.name).toBe("制衡");
    expect(sunQuanZhiheng.type).toBe("active");
    expect(typeof sunQuanZhiheng.script).toBe("string");
    expect(sunQuanZhiheng.trigger).toBe("playPhase");
    expect(sunQuanZhiheng.validTargets).toBe("self");
  });
});

describe("Sanguosha Characters — Qun Faction", () => {
  it("lvbu wushuang should have correct structure", () => {
    expect(lvBuWuShuang.id).toBe("wushuang");
    expect(lvBuWuShuang.name).toBe("无双");
    expect(lvBuWuShuang.type).toBe("passive");
    expect(typeof lvBuWuShuang.script).toBe("string");
    expect(lvBuWuShuang.script).toContain("double_shan_required");
    expect(lvBuWuShuang.trigger).toBe("playSha");
    expect(lvBuWuShuang.validTargets).toBe("enemy");
  });

  it("diaochan lijian should have correct structure", () => {
    expect(diaoChanLiJian.id).toBe("lijian");
    expect(diaoChanLiJian.name).toBe("离间");
    expect(diaoChanLiJian.type).toBe("active");
    expect(typeof diaoChanLiJian.script).toBe("string");
    expect(diaoChanLiJian.script).toContain("context.requestResponse");
    expect(diaoChanLiJian.trigger).toBe("playPhase");
    expect(diaoChanLiJian.validTargets).toBe("twoOthers");
  });

  it("diaochan biyue should have correct structure", () => {
    expect(diaoChanBiYue.id).toBe("biyue");
    expect(diaoChanBiYue.name).toBe("闭月");
    expect(diaoChanBiYue.type).toBe("passive");
    expect(typeof diaoChanBiYue.script).toBe("string");
    expect(diaoChanBiYue.script).toContain("context.log");
    expect(diaoChanBiYue.trigger).toBe("endPhase");
    expect(diaoChanBiYue.validTargets).toBe("self");
  });

  it("huatuo qingnang should have correct structure", () => {
    expect(huaTuoQingNang.id).toBe("qingnang");
    expect(huaTuoQingNang.name).toBe("青囊");
    expect(huaTuoQingNang.type).toBe("active");
    expect(typeof huaTuoQingNang.script).toBe("string");
    expect(huaTuoQingNang.script).toContain("context.setResource");
    expect(huaTuoQingNang.trigger).toBe("playPhase");
    expect(huaTuoQingNang.validTargets).toBe("other");
  });

  it("huatuo jijiu should have correct structure", () => {
    expect(huaTuoJiJiu.id).toBe("jijiu");
    expect(huaTuoJiJiu.name).toBe("急救");
    expect(huaTuoJiJiu.type).toBe("passive");
    expect(typeof huaTuoJiJiu.script).toBe("string");
    expect(huaTuoJiJiu.script).toContain("convert_peach_to_shan");
    expect(huaTuoJiJiu.trigger).toBe("playShan");
    expect(huaTuoJiJiu.validTargets).toBe("self");
  });
});

describe("Character skill IDs uniqueness", () => {
  it("all skill ids should be unique", () => {
    const allSkillIds = [
      caoCaoJueji.id,
      liuBeiRende.id,
      sunQuanZhiheng.id,
      guanYuWuSheng.id,
      zhangFeiBaqi.id,
      zhaoYunLongDan.id,
      lvBuWuShuang.id,
      diaoChanLiJian.id,
      diaoChanBiYue.id,
      huaTuoQingNang.id,
      huaTuoJiJiu.id,
      simaYiFanKui.id,
      simaYiGuiCai.id,
    ];
    const uniqueIds = new Set(allSkillIds);
    expect(uniqueIds.size).toBe(13);
  });
});

describe("Character skills count by faction", () => {
  it("wei should have 2 characters with 3 skills", () => {
    const weiSkills = [caoCaoJueji, simaYiFanKui, simaYiGuiCai];
    expect(weiSkills.length).toBe(3);
  });

  it("shu should have 4 characters with 4 skills", () => {
    const shuSkills = [liuBeiRende, guanYuWuSheng, zhangFeiBaqi, zhaoYunLongDan];
    expect(shuSkills.length).toBe(4);
  });

  it("wu should have 1 character with 1 skill", () => {
    const wuSkills = [sunQuanZhiheng];
    expect(wuSkills.length).toBe(1);
  });

  it("qun should have 3 characters with 5 skills", () => {
    const qunSkills = [lvBuWuShuang, diaoChanLiJian, diaoChanBiYue, huaTuoQingNang, huaTuoJiJiu];
    expect(qunSkills.length).toBe(5);
  });

  it("total skills should be 13 across 10 characters", () => {
    const allSkills = [
      caoCaoJueji, simaYiFanKui, simaYiGuiCai,
      liuBeiRende, guanYuWuSheng, zhangFeiBaqi, zhaoYunLongDan,
      sunQuanZhiheng,
      lvBuWuShuang, diaoChanLiJian, diaoChanBiYue, huaTuoQingNang, huaTuoJiJiu,
    ];
    expect(allSkills.length).toBe(13);
  });
});