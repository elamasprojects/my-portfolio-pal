-- Corrida diaria del import de la tarjeta personal, 09:00 Buenos Aires (12:00 UTC).
--
-- El secreto NO queda escrito en la definicion del job: el subselect lo lee en
-- cada disparo desde `app_config`. Asi rotarlo es un UPDATE, no reescribir el
-- cron -- y el secreto no queda expuesto en `cron.job`, que es legible por
-- cualquiera que pueda mirar el schema.
--
-- timeout de 60s: la funcion hace una llamada a Mercury mas un insert por
-- transaccion nueva. Los 5s que pg_net usa por default cortarian la corrida a la
-- mitad y dejarian la mitad de los gastos sin importar.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'mercury-personal-import') then
    perform cron.unschedule('mercury-personal-import');
  end if;
end$$;

select cron.schedule(
  'mercury-personal-import',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://yimbswiaqmuggmqygicf.supabase.co/functions/v1/mercury-personal-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value #>> '{}' from public.app_config where key = 'cron_secret_mercury_personal_import')
    ),
    body := '{"source": "cron"}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
