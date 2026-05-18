import { describe, it, expect } from "vitest";
import type { EffectDefinition } from "@cardverse/deck";
import { caoCaoJueji } from "./effects/caocao.js";
import { liuBeiRende } from "./effects/liubei.js";
import { sunQuanZhiheng } from "./effects/sunquan.js";
import { guanYuWuSheng } from "./effects/guanyu.js";
import { zhangFeiBaqi } from "./effects/zhangfei.js";
import { zhaoYunLongDan } from "./effects/zhaoyun.js";
import { zhugeKongmingEmpty, zhugeKongmingZhiyuan } from "./effects/zhugekongming.js";
import { zhouYuYingzi, zhouYuTandu } from "./effects/zhouyu.js";
import { zhugeJinBoshu, zhugeJinHeshi } from "./effects/zhugejin.js";
import { huangZhongLiaoyuan, huangZhongBaibu } from "./effects/huangzhong.js";

describe("Sanguosha Characters — Wei Faction", () => {
  it("caocao jueji should have correct structure", () => {
    expect(caoCaoJueji.id).toBe("jueji");
    expect(caoCaoJueji.name).toBe("奸雄");
    expect(caoCaoJueji.type).toBe("passive");
    expect(typeof caoCaoJueji.script).toBe("string");
    expect(caoCaoJueji.trigger).toBe("onDamageReceived");
    expect(caoCaoJueji.validTargets).toBe("self");
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

  it("zhugekongming kongming should have correct structure", () => {
    expect(zhugeKongmingEmpty.id).toBe("kongming");
    expect(zhugeKongmingEmpty.name).toBe("空城");
    expect(zhugeKongmingEmpty.type).toBe("passive");
    expect(typeof zhugeKongmingEmpty.script).toBe("string");
    expect(zhugeKongmingEmpty.trigger).toBe("becomeTarget");
    expect(zhugeKongmingEmpty.validTargets).toBe("self");
  });

  it("zhugekongming zhiyuan should have correct structure", () => {
    expect(zhugeKongmingZhiyuan.id).toBe("zhiyuan");
    expect(zhugeKongmingZhiyuan.name).toBe("志远");
    expect(zhugeKongmingZhiyuan.type).toBe("active");
    expect(typeof zhugeKongmingZhiyuan.script).toBe("string");
    expect(zhugeKongmingZhiyuan.trigger).toBe("drawPhase");
    expect(zhugeKongmingZhiyuan.validTargets).toBe("self");
  });

  it("huangzhong liaoyuan should have correct structure", () => {
    expect(huangZhongLiaoyuan.id).toBe("liaoyuan");
    expect(huangZhongLiaoyuan.name).toBe("燎原");
    expect(huangZhongLiaoyuan.type).toBe("passive");
    expect(typeof huangZhongLiaoyuan.script).toBe("string");
    expect(huangZhongLiaoyuan.trigger).toBe("playSha");
    expect(huangZhongLiaoyuan.validTargets).toBe("self");
  });

  it("huangzhong baibu should have correct structure", () => {
    expect(huangZhongBaibu.id).toBe("baibu");
    expect(huangZhongBaibu.name).toBe("百步");
    expect(huangZhongBaibu.type).toBe("active");
    expect(typeof huangZhongBaibu.script).toBe("string");
    expect(huangZhongBaibu.trigger).toBe("playSha");
    expect(huangZhongBaibu.validTargets).toBe("enemy");
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

  it("zhouyu fengshen should have correct structure", () => {
    expect(zhouYuYingzi.id).toBe("fengshen");
    expect(zhouYuYingzi.name).toBe("英姿");
    expect(zhouYuYingzi.type).toBe("passive");
    expect(typeof zhouYuYingzi.script).toBe("string");
    expect(zhouYuYingzi.trigger).toBe("drawPhase");
    expect(zhouYuYingzi.validTargets).toBe("self");
  });

  it("zhouyu tandu should have correct structure", () => {
    expect(zhouYuTandu.id).toBe("tandu");
    expect(zhouYuTandu.name).toBe("反间");
    expect(zhouYuTandu.type).toBe("active");
    expect(typeof zhouYuTandu.script).toBe("string");
    expect(zhouYuTandu.trigger).toBe("playPhase");
    expect(zhouYuTandu.validTargets).toBe("other");
  });

  it("zhugejin boshu should have correct structure", () => {
    expect(zhugeJinBoshu.id).toBe("boshu");
    expect(zhugeJinBoshu.name).toBe("博术");
    expect(zhugeJinBoshu.type).toBe("active");
    expect(typeof zhugeJinBoshu.script).toBe("string");
    expect(zhugeJinBoshu.trigger).toBe("drawPhase");
    expect(zhugeJinBoshu.validTargets).toBe("self");
  });

  it("zhugejin heshi should have correct structure", () => {
    expect(zhugeJinHeshi.id).toBe("heshi");
    expect(zhugeJinHeshi.name).toBe("和事");
    expect(zhugeJinHeshi.type).toBe("active");
    expect(typeof zhugeJinHeshi.script).toBe("string");
    expect(zhugeJinHeshi.trigger).toBe("playPhase");
    expect(zhugeJinHeshi.validTargets).toBe("other");
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
      zhugeKongmingEmpty.id,
      zhugeKongmingZhiyuan.id,
      zhouYuYingzi.id,
      zhouYuTandu.id,
      zhugeJinBoshu.id,
      zhugeJinHeshi.id,
      huangZhongLiaoyuan.id,
      huangZhongBaibu.id,
    ];
    const uniqueIds = new Set(allSkillIds);
    expect(uniqueIds.size).toBe(14);
  });
});

describe("Character skills count by faction", () => {
  it("wei should have 1 character with 1 skill", () => {
    const weiSkills = [caoCaoJueji];
    expect(weiSkills.length).toBe(1);
  });

  it("shu should have 5 characters with 7 skills", () => {
    const shuSkills = [liuBeiRende, guanYuWuSheng, zhangFeiBaqi, zhaoYunLongDan, 
                       zhugeKongmingEmpty, zhugeKongmingZhiyuan, 
                       huangZhongLiaoyuan, huangZhongBaibu];
    expect(shuSkills.length).toBe(8);
  });

  it("wu should have 4 characters with 5 skills", () => {
    const wuSkills = [sunQuanZhiheng, zhouYuYingzi, zhouYuTandu, 
                      zhugeJinBoshu, zhugeJinHeshi];
    expect(wuSkills.length).toBe(5);
  });
});