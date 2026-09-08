-- Ya aplicado en la base el 2026-09-08.
-- Fase 2: precio unitario, avance físico, partida de contingencia.

-- Un concepto puede capturarse como cantidad × precio unitario. presupuesto sigue
-- siendo el total sin IVA (fuente de verdad para todos los cálculos); cuando hay
-- precio unitario, el cliente lo calcula como cantidad × precio_unitario.
alter table conceptos
  add column if not exists cantidad        numeric(14,3) not null default 1,
  add column if not exists unidad          text          not null default '',
  add column if not exists precio_unitario numeric(14,2) not null default 0,
  -- avance físico real, 0 a 100, capturado por el arquitecto
  add column if not exists avance          numeric(5,2)  not null default 0
    check (avance >= 0 and avance <= 100);

-- La partida marcada como contingencia es la reserva de imprevistos: su candado
-- se traspasa a las partidas que crecen y se reporta aparte.
alter table partidas
  add column if not exists contingencia boolean not null default false;
