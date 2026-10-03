import {describe,expect,it} from 'vitest';
import {Line} from 'three';
import {buildBmwSkeleton} from './bmwStudy';
describe('BMW 独立骨架场景',()=>{
  it('只生成有限线段和四个轮心圆，没有 A4 Mesh 或车头细节',()=>{
    const study=buildBmwSkeleton();
    expect(study.group.children.filter(o=>o.name.startsWith('hub-'))).toHaveLength(4);
    for(const o of study.group.children){
      expect(o).toBeInstanceOf(Line);
      const positions=(o as Line).geometry.getAttribute('position').array;
      expect(Array.from(positions).every(Number.isFinite)).toBe(true);
    }
    study.dispose();
  });
});
