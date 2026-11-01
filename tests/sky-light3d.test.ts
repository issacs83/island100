import test from 'node:test';
import assert from 'node:assert/strict';
import {Color} from 'three';
import {DAY, NIGHT} from '../src/render3d/look.ts';
import {daylight} from '../src/render3d/sky-light3d.ts';

const same = (a: Color, hex: string) => a.equals(new Color(hex));

test('Daylight at 0 and 1 is exactly the day and night palette', () => {
  const day = daylight(0), night = daylight(1);
  assert.ok(same(day.hemiSky, DAY.hemi[0]) && same(day.fog, DAY.fog) && same(day.water[2], DAY.water[2]));
  assert.equal(day.sunIntensity, DAY.sun[1]); assert.equal(day.exposure, DAY.exposure); assert.deepEqual(day.sunOffset, DAY.sun[2]); assert.equal(day.night, false);
  assert.ok(same(night.hemiSky, NIGHT.hemi[0]) && same(night.fog, NIGHT.fog) && same(night.tint, NIGHT.tint));
  assert.equal(night.sunIntensity, NIGHT.sun[1]); assert.deepEqual(night.sunOffset, NIGHT.sun[2]); assert.equal(night.night, true);
});

test('Dusk sits between day and night and the moon takes over past half', () => {
  const dusk = daylight(.25);
  assert.ok(dusk.sunIntensity < DAY.sun[1] && dusk.sunIntensity > NIGHT.sun[1]);
  assert.deepEqual(dusk.sunOffset, DAY.sun[2]);
  assert.deepEqual(daylight(.6).sunOffset, NIGHT.sun[2]);
  assert.equal(daylight(-1).sunIntensity, DAY.sun[1]);
  assert.equal(daylight(3).sunIntensity, NIGHT.sun[1]);
});
