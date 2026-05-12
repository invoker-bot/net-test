// ACC Physics shared-memory layout (SPageFilePhysics).
//
// Field order, types, and offsets are cross-checked against the read sequence
// in both reference implementations — neither documents offsets directly, both
// just read sequentially from offset 0, so the offsets below are what falls
// out of those reads:
//   - https://github.com/rrennoir/PyAccSharedMemory  (src/pyaccsharedmemory.py, read_physic_map)
//   - https://gitlab.com/ai-projects219/race-engineer/acc-shared-memory-rust  (src/parsers/physics_parser.rs)
//
// Both repos read identical sequences. Fields they explicitly mark "not used
// by ACC" (wheelLoad, tyreWear, tyreDirtyLevel, camberRAD, cgHeight, kersCharge,
// kersInput, rideHeight, ballast, airDensity, performanceMeter, engineBrake,
// ers*, drsAvailable, drsEnabled, tyreTempI/M/O, P2P, currentMaxRpm, mz/fz/my,
// tcinAction, absinAction, suspensionDamage, duplicate tyreTemp) are skipped
// in this preset but their slots still account for the offsets that follow.
//
// One easy-to-miss detail: the `drs` slot at offset 200 is an i32, not f32.
export const ACC_PHYSICS_PRESET = {
  name: 'ACC Physics', endian: 'LE', size: 800, builtin: true,
  fields: [
    // Header
    { id: 'acc_packetId',  name: 'packetId',  type: 'int32',   offset: 0,   size: 4, colorIdx: 0,  fmt: 'dec', note: 'physics tick counter; increments every game tick. Frozen value = game paused or not in session.' },

    // Driver inputs
    { id: 'acc_gas',       name: 'gas',        type: 'float32', offset: 4,   size: 4, colorIdx: 1,  fmt: 'f2',                note: 'throttle pedal, 0..1' },
    { id: 'acc_brake',     name: 'brake',      type: 'float32', offset: 8,   size: 4, colorIdx: 2,  fmt: 'f2',                note: 'brake pedal, 0..1' },
    { id: 'acc_fuel',      name: 'fuel',       type: 'float32', offset: 12,  size: 4, colorIdx: 3,  fmt: 'f2', unit: 'L',     note: 'liters remaining in tank' },
    { id: 'acc_gear',      name: 'gear',       type: 'int32',   offset: 16,  size: 4, colorIdx: 4,  fmt: 'dec',                note: '0=reverse, 1=neutral, 2=1st, 3=2nd, ...' },
    { id: 'acc_rpms',      name: 'rpms',       type: 'int32',   offset: 20,  size: 4, colorIdx: 5,  fmt: 'dec', unit: 'rpm',  note: 'engine RPM' },
    { id: 'acc_steer',     name: 'steerAngle', type: 'float32', offset: 24,  size: 4, colorIdx: 6,  fmt: 'f2',                note: 'steering input, normalized -1..+1 per ACC SDK (Rust doc says degrees — SDK wins)' },
    { id: 'acc_speed',     name: 'speedKmh',   type: 'float32', offset: 28,  size: 4, colorIdx: 7,  fmt: 'f1', unit: 'km/h',  note: 'wheel speed' },

    // World velocity & G-force (Vector3f each)
    { id: 'acc_velX',      name: 'velocity.x', type: 'float32', offset: 32,  size: 4, colorIdx: 8,  fmt: 'f2', unit: 'm/s',   note: 'world-space velocity X' },
    { id: 'acc_velY',      name: 'velocity.y', type: 'float32', offset: 36,  size: 4, colorIdx: 8,  fmt: 'f2', unit: 'm/s',   note: 'world-space velocity Y (vertical)' },
    { id: 'acc_velZ',      name: 'velocity.z', type: 'float32', offset: 40,  size: 4, colorIdx: 8,  fmt: 'f2', unit: 'm/s',   note: 'world-space velocity Z' },
    { id: 'acc_accX',      name: 'accG.x',     type: 'float32', offset: 44,  size: 4, colorIdx: 9,  fmt: 'f2', unit: 'g',     note: 'lateral G — cornering load' },
    { id: 'acc_accY',      name: 'accG.y',     type: 'float32', offset: 48,  size: 4, colorIdx: 9,  fmt: 'f2', unit: 'g',     note: 'vertical G — bumps, kerbs' },
    { id: 'acc_accZ',      name: 'accG.z',     type: 'float32', offset: 52,  size: 4, colorIdx: 9,  fmt: 'f2', unit: 'g',     note: 'longitudinal G — accel / brake' },

    // Wheels block: slip, [wheelLoad skip 72-88], pressure, angularSpeed,
    // [tyreWear skip 120-136], [dirty skip 136-152], coreTemp,
    // [camberRAD skip 168-184], suspensionTravel
    { id: 'acc_slipFL',    name: 'wheelSlip.FL',     type: 'float32', offset: 56,  size: 4, colorIdx: 10, fmt: 'f2',                note: 'wheel-slip indicator FL (older metric — use slipRatio/slipAngle for tyre model work)' },
    { id: 'acc_slipFR',    name: 'wheelSlip.FR',     type: 'float32', offset: 60,  size: 4, colorIdx: 10, fmt: 'f2',                note: 'wheel-slip indicator FR' },
    { id: 'acc_slipRL',    name: 'wheelSlip.RL',     type: 'float32', offset: 64,  size: 4, colorIdx: 10, fmt: 'f2',                note: 'wheel-slip indicator RL' },
    { id: 'acc_slipRR',    name: 'wheelSlip.RR',     type: 'float32', offset: 68,  size: 4, colorIdx: 10, fmt: 'f2',                note: 'wheel-slip indicator RR' },
    { id: 'acc_presFL',    name: 'tirePressure.FL',  type: 'float32', offset: 88,  size: 4, colorIdx: 11, fmt: 'f1', unit: 'psi',   note: 'front-left tire pressure' },
    { id: 'acc_presFR',    name: 'tirePressure.FR',  type: 'float32', offset: 92,  size: 4, colorIdx: 11, fmt: 'f1', unit: 'psi',   note: 'front-right tire pressure' },
    { id: 'acc_presRL',    name: 'tirePressure.RL',  type: 'float32', offset: 96,  size: 4, colorIdx: 11, fmt: 'f1', unit: 'psi',   note: 'rear-left tire pressure' },
    { id: 'acc_presRR',    name: 'tirePressure.RR',  type: 'float32', offset: 100, size: 4, colorIdx: 11, fmt: 'f1', unit: 'psi',   note: 'rear-right tire pressure' },
    { id: 'acc_angFL',     name: 'wheelAngSpeed.FL', type: 'float32', offset: 104, size: 4, colorIdx: 12, fmt: 'f2', unit: 'rad/s', note: 'FL wheel angular velocity (locking detection)' },
    { id: 'acc_angFR',     name: 'wheelAngSpeed.FR', type: 'float32', offset: 108, size: 4, colorIdx: 12, fmt: 'f2', unit: 'rad/s', note: 'FR wheel angular velocity' },
    { id: 'acc_angRL',     name: 'wheelAngSpeed.RL', type: 'float32', offset: 112, size: 4, colorIdx: 12, fmt: 'f2', unit: 'rad/s', note: 'RL wheel angular velocity' },
    { id: 'acc_angRR',     name: 'wheelAngSpeed.RR', type: 'float32', offset: 116, size: 4, colorIdx: 12, fmt: 'f2', unit: 'rad/s', note: 'RR wheel angular velocity' },
    { id: 'acc_tcoreFL',   name: 'tireCoreTemp.FL',  type: 'float32', offset: 152, size: 4, colorIdx: 0,  fmt: 'f1', unit: '°C',    note: 'FL tire core temperature (target window varies by compound)' },
    { id: 'acc_tcoreFR',   name: 'tireCoreTemp.FR',  type: 'float32', offset: 156, size: 4, colorIdx: 0,  fmt: 'f1', unit: '°C',    note: 'FR tire core temperature' },
    { id: 'acc_tcoreRL',   name: 'tireCoreTemp.RL',  type: 'float32', offset: 160, size: 4, colorIdx: 0,  fmt: 'f1', unit: '°C',    note: 'RL tire core temperature' },
    { id: 'acc_tcoreRR',   name: 'tireCoreTemp.RR',  type: 'float32', offset: 164, size: 4, colorIdx: 0,  fmt: 'f1', unit: '°C',    note: 'RR tire core temperature' },
    { id: 'acc_susFL',     name: 'suspTravel.FL',    type: 'float32', offset: 184, size: 4, colorIdx: 1,  fmt: 'f2', unit: 'm',     note: 'FL suspension travel — PyAcc uses this field to detect "physics is updating"' },
    { id: 'acc_susFR',     name: 'suspTravel.FR',    type: 'float32', offset: 188, size: 4, colorIdx: 1,  fmt: 'f2', unit: 'm',     note: 'FR suspension travel' },
    { id: 'acc_susRL',     name: 'suspTravel.RL',    type: 'float32', offset: 192, size: 4, colorIdx: 1,  fmt: 'f2', unit: 'm',     note: 'RL suspension travel' },
    { id: 'acc_susRR',     name: 'suspTravel.RR',    type: 'float32', offset: 196, size: 4, colorIdx: 1,  fmt: 'f2', unit: 'm',     note: 'RR suspension travel' },

    // Orientation block ([cgHeight skip 220-224])
    { id: 'acc_drs',       name: 'drs',       type: 'int32',   offset: 200, size: 4, colorIdx: 2,  fmt: 'dec',                note: 'DRS — typed i32 in the SDK; deprecated in ACC, reads 0' },
    { id: 'acc_tc',        name: 'tc',        type: 'float32', offset: 204, size: 4, colorIdx: 2,  fmt: 'f2',                 note: 'traction control intervention level' },
    { id: 'acc_heading',   name: 'heading',   type: 'float32', offset: 208, size: 4, colorIdx: 3,  fmt: 'f2', unit: 'rad',   note: 'car yaw angle (world)' },
    { id: 'acc_pitch',     name: 'pitch',     type: 'float32', offset: 212, size: 4, colorIdx: 3,  fmt: 'f2', unit: 'rad',   note: 'car pitch angle' },
    { id: 'acc_roll',      name: 'roll',      type: 'float32', offset: 216, size: 4, colorIdx: 3,  fmt: 'f2', unit: 'rad',   note: 'car roll angle' },

    // Damage accumulators (front / rear / left / right / centre)
    { id: 'acc_dmgF',      name: 'carDamage.front',  type: 'float32', offset: 224, size: 4, colorIdx: 4, fmt: 'f2',         note: 'front impact damage accumulator' },
    { id: 'acc_dmgR',      name: 'carDamage.rear',   type: 'float32', offset: 228, size: 4, colorIdx: 4, fmt: 'f2',         note: 'rear impact damage accumulator' },
    { id: 'acc_dmgL',      name: 'carDamage.left',   type: 'float32', offset: 232, size: 4, colorIdx: 4, fmt: 'f2',         note: 'left impact damage accumulator' },
    { id: 'acc_dmgRi',     name: 'carDamage.right',  type: 'float32', offset: 236, size: 4, colorIdx: 4, fmt: 'f2',         note: 'right impact damage accumulator' },
    { id: 'acc_dmgC',      name: 'carDamage.centre', type: 'float32', offset: 240, size: 4, colorIdx: 4, fmt: 'f2',         note: 'overall (centre / summed) damage' },

    // Pit / ABS / shifter (numberOfTyresOut @244 skipped — explicitly unused)
    { id: 'acc_pitLim',    name: 'pitLimiter', type: 'int32',  offset: 248, size: 4, colorIdx: 5,  fmt: 'dec',                note: '1 if pit-lane speed limiter is active' },
    { id: 'acc_abs',       name: 'abs',        type: 'float32', offset: 252, size: 4, colorIdx: 5,  fmt: 'f2',                note: 'ABS intervention level' },
    { id: 'acc_autoShift', name: 'autoShift',  type: 'int32',  offset: 264, size: 4, colorIdx: 5,  fmt: 'dec',                note: '1 if automatic gear-shifting is enabled' },
    { id: 'acc_turbo',     name: 'turboBoost', type: 'float32', offset: 276, size: 4, colorIdx: 6,  fmt: 'f2', unit: 'bar',  note: 'turbo boost pressure' },

    // Environment + FFB ([ballast/airDensity skipped — deprecated])
    { id: 'acc_airTemp',   name: 'airTemp',           type: 'float32', offset: 288, size: 4, colorIdx: 7,  fmt: 'f1', unit: '°C', note: 'ambient air temperature' },
    { id: 'acc_roadTemp',  name: 'roadTemp',          type: 'float32', offset: 292, size: 4, colorIdx: 7,  fmt: 'f1', unit: '°C', note: 'track surface temperature' },
    { id: 'acc_avelX',     name: 'localAngularVel.x', type: 'float32', offset: 296, size: 4, colorIdx: 8,  fmt: 'f2', unit: 'rad/s', note: 'angular velocity X (pitch rate, car frame)' },
    { id: 'acc_avelY',     name: 'localAngularVel.y', type: 'float32', offset: 300, size: 4, colorIdx: 8,  fmt: 'f2', unit: 'rad/s', note: 'angular velocity Y (yaw rate)' },
    { id: 'acc_avelZ',     name: 'localAngularVel.z', type: 'float32', offset: 304, size: 4, colorIdx: 8,  fmt: 'f2', unit: 'rad/s', note: 'angular velocity Z (roll rate)' },
    { id: 'acc_ff',        name: 'finalFF',           type: 'float32', offset: 308, size: 4, colorIdx: 9,  fmt: 'f2',                note: 'final force-feedback magnitude sent to the wheel' },

    // Brake temps & clutch ([ERS/KERS/drsAvail/drsEnabled skipped 312-348])
    { id: 'acc_brkFL',     name: 'brakeTemp.FL', type: 'float32', offset: 348, size: 4, colorIdx: 10, fmt: 'f1', unit: '°C', note: 'FL brake disc temperature' },
    { id: 'acc_brkFR',     name: 'brakeTemp.FR', type: 'float32', offset: 352, size: 4, colorIdx: 10, fmt: 'f1', unit: '°C', note: 'FR brake disc temperature' },
    { id: 'acc_brkRL',     name: 'brakeTemp.RL', type: 'float32', offset: 356, size: 4, colorIdx: 10, fmt: 'f1', unit: '°C', note: 'RL brake disc temperature' },
    { id: 'acc_brkRR',     name: 'brakeTemp.RR', type: 'float32', offset: 360, size: 4, colorIdx: 10, fmt: 'f1', unit: '°C', note: 'RR brake disc temperature' },
    { id: 'acc_clutch',    name: 'clutch',       type: 'float32', offset: 364, size: 4, colorIdx: 11, fmt: 'f2',                note: 'clutch pedal, 0..1 (1 = fully engaged)' },

    // AI flag (tyreTemp I/M/O @368-416 skipped)
    { id: 'acc_isAI',      name: 'isAIControlled', type: 'int32', offset: 416, size: 4, colorIdx: 12, fmt: 'dec',          note: '1 if car is AI-controlled' },

    // Contact points block (3 × Vector3f[4] = 144 bytes) skipped — useful for
    // tyre-model work but heavy; rebuild as a separate preset if needed.

    // Brake bias + local-frame velocity
    { id: 'acc_brakeBias', name: 'brakeBias',       type: 'float32', offset: 564, size: 4, colorIdx: 0, fmt: 'f2',               note: 'brake bias forward (0..1; 0.5 = 50/50)' },
    { id: 'acc_lvelX',     name: 'localVelocity.x', type: 'float32', offset: 568, size: 4, colorIdx: 1, fmt: 'f2', unit: 'm/s',  note: 'velocity in car-local frame X (lateral)' },
    { id: 'acc_lvelY',     name: 'localVelocity.y', type: 'float32', offset: 572, size: 4, colorIdx: 1, fmt: 'f2', unit: 'm/s',  note: 'velocity in car-local frame Y' },
    { id: 'acc_lvelZ',     name: 'localVelocity.z', type: 'float32', offset: 576, size: 4, colorIdx: 1, fmt: 'f2', unit: 'm/s',  note: 'velocity in car-local frame Z (forward)' },

    // Modern tyre-model slip ([P2P/currentMaxRpm/mz/fz/my skipped 580-640])
    { id: 'acc_srFL',      name: 'slipRatio.FL', type: 'float32', offset: 640, size: 4, colorIdx: 2, fmt: 'f2',               note: 'FL longitudinal slip ratio (modern tyre model)' },
    { id: 'acc_srFR',      name: 'slipRatio.FR', type: 'float32', offset: 644, size: 4, colorIdx: 2, fmt: 'f2',               note: 'FR longitudinal slip ratio' },
    { id: 'acc_srRL',      name: 'slipRatio.RL', type: 'float32', offset: 648, size: 4, colorIdx: 2, fmt: 'f2',               note: 'RL longitudinal slip ratio' },
    { id: 'acc_srRR',      name: 'slipRatio.RR', type: 'float32', offset: 652, size: 4, colorIdx: 2, fmt: 'f2',               note: 'RR longitudinal slip ratio' },
    { id: 'acc_saFL',      name: 'slipAngle.FL', type: 'float32', offset: 656, size: 4, colorIdx: 3, fmt: 'f2', unit: 'rad', note: 'FL lateral slip angle' },
    { id: 'acc_saFR',      name: 'slipAngle.FR', type: 'float32', offset: 660, size: 4, colorIdx: 3, fmt: 'f2', unit: 'rad', note: 'FR lateral slip angle' },
    { id: 'acc_saRL',      name: 'slipAngle.RL', type: 'float32', offset: 664, size: 4, colorIdx: 3, fmt: 'f2', unit: 'rad', note: 'RL lateral slip angle' },
    { id: 'acc_saRR',      name: 'slipAngle.RR', type: 'float32', offset: 668, size: 4, colorIdx: 3, fmt: 'f2', unit: 'rad', note: 'RR lateral slip angle' },

    // Engine cooling ([tcinAction/absinAction/suspensionDamage/dup-tyreTemp skipped 672-712])
    { id: 'acc_waterT',    name: 'waterTemp', type: 'float32', offset: 712, size: 4, colorIdx: 4, fmt: 'f1', unit: '°C',     note: 'engine water/coolant temperature' },

    // Brakes hydraulics + wear
    { id: 'acc_bpFL',      name: 'brakePressure.FL', type: 'float32', offset: 716, size: 4, colorIdx: 5, fmt: 'f2',         note: 'FL brake hydraulic pressure' },
    { id: 'acc_bpFR',      name: 'brakePressure.FR', type: 'float32', offset: 720, size: 4, colorIdx: 5, fmt: 'f2',         note: 'FR brake hydraulic pressure' },
    { id: 'acc_bpRL',      name: 'brakePressure.RL', type: 'float32', offset: 724, size: 4, colorIdx: 5, fmt: 'f2',         note: 'RL brake hydraulic pressure' },
    { id: 'acc_bpRR',      name: 'brakePressure.RR', type: 'float32', offset: 728, size: 4, colorIdx: 5, fmt: 'f2',         note: 'RR brake hydraulic pressure' },
    { id: 'acc_fbc',       name: 'frontBrakeCompound', type: 'int32', offset: 732, size: 4, colorIdx: 6, fmt: 'dec',        note: 'front brake compound selector' },
    { id: 'acc_rbc',       name: 'rearBrakeCompound',  type: 'int32', offset: 736, size: 4, colorIdx: 6, fmt: 'dec',        note: 'rear brake compound selector' },
    { id: 'acc_padFL',     name: 'padLife.FL',  type: 'float32', offset: 740, size: 4, colorIdx: 7, fmt: 'f2',              note: 'FL brake pad remaining life' },
    { id: 'acc_padFR',     name: 'padLife.FR',  type: 'float32', offset: 744, size: 4, colorIdx: 7, fmt: 'f2',              note: 'FR brake pad remaining life' },
    { id: 'acc_padRL',     name: 'padLife.RL',  type: 'float32', offset: 748, size: 4, colorIdx: 7, fmt: 'f2',              note: 'RL brake pad remaining life' },
    { id: 'acc_padRR',     name: 'padLife.RR',  type: 'float32', offset: 752, size: 4, colorIdx: 7, fmt: 'f2',              note: 'RR brake pad remaining life' },
    { id: 'acc_discFL',    name: 'discLife.FL', type: 'float32', offset: 756, size: 4, colorIdx: 8, fmt: 'f2',              note: 'FL brake disc remaining life' },
    { id: 'acc_discFR',    name: 'discLife.FR', type: 'float32', offset: 760, size: 4, colorIdx: 8, fmt: 'f2',              note: 'FR brake disc remaining life' },
    { id: 'acc_discRL',    name: 'discLife.RL', type: 'float32', offset: 764, size: 4, colorIdx: 8, fmt: 'f2',              note: 'RL brake disc remaining life' },
    { id: 'acc_discRR',    name: 'discLife.RR', type: 'float32', offset: 768, size: 4, colorIdx: 8, fmt: 'f2',              note: 'RR brake disc remaining life' },

    // Engine state
    { id: 'acc_ignOn',     name: 'ignitionOn',      type: 'int32', offset: 772, size: 4, colorIdx: 9,  fmt: 'dec',            note: '1 if ignition switch is on' },
    { id: 'acc_starterOn', name: 'starterEngineOn', type: 'int32', offset: 776, size: 4, colorIdx: 9,  fmt: 'dec',            note: '1 if starter motor is engaged' },
    { id: 'acc_engRun',    name: 'isEngineRunning', type: 'int32', offset: 780, size: 4, colorIdx: 9,  fmt: 'dec',            note: '1 if engine is running' },

    // Haptics / FFB vibrations
    { id: 'acc_vibK',      name: 'kerbVibration',  type: 'float32', offset: 784, size: 4, colorIdx: 10, fmt: 'f2',           note: 'kerb-strike vibration intensity' },
    { id: 'acc_vibS',      name: 'slipVibration',  type: 'float32', offset: 788, size: 4, colorIdx: 11, fmt: 'f2',           note: 'tire-slip vibration intensity' },
    { id: 'acc_vibG',      name: 'gVibration',     type: 'float32', offset: 792, size: 4, colorIdx: 12, fmt: 'f2',           note: 'G-load vibration intensity' },
    { id: 'acc_vibA',      name: 'absVibration',   type: 'float32', offset: 796, size: 4, colorIdx: 0,  fmt: 'f2',           note: 'ABS pulse vibration intensity' },
  ],
};
