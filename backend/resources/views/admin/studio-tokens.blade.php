<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Tokens da API · RDM Studio</title>
<link rel="icon" href="{{ asset('admin/rdm-studio/favicon.svg') }}" type="image/svg+xml">
<style>
  :root { color-scheme: dark; --bg: #05060b; --panel: #0d0f1a; --line: #23263a; --text: #e6e6f0; --muted: #9a9cb5; --accent: #8c6bff; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 16px; }
  h1 { font-weight: 400; font-size: 26px; margin: 0 0 8px; }
  p { color: var(--muted); margin: 0 0 24px; }
  section { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  label { display: block; color: var(--muted); font-size: 13px; margin-bottom: 4px; }
  input { background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; font: inherit; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; }
  button { background: var(--accent); color: #fff; border: 0; border-radius: 6px; padding: 9px 16px; font: inherit; cursor: pointer; }
  button.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); padding: 5px 10px; }
  code { display: block; word-break: break-all; background: var(--bg); border: 1px solid var(--accent); border-radius: 6px; padding: 12px; font-size: 14px; user-select: all; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 400; }
  .error { color: #ff8c8c; font-size: 13px; }
  a { color: var(--accent); }
  .scroll { overflow-x: auto; }
  td { white-space: nowrap; }
</style>
</head>
<body>
<main>
  <h1>Tokens da API do Studio</h1>
  <p>Cada token dá acesso à API do Studio: listar, ler, editar, publicar e agendar. Apagar continua só no <a href="{{ route('rdm-studio') }}">Studio</a>. Envie como <code style="display:inline;padding:1px 4px;border:0">Authorization: Bearer &lt;token&gt;</code> para:</p>
  <section><code>{{ $apiBase }}</code></section>

  @if ($issued)
    <section>
      <label>Token novo. Copie agora: ele não aparece de novo.</label>
      <code>{{ $issued }}</code>
    </section>
  @endif

  <section>
    <form method="post" action="{{ route('studio-tokens.store') }}">
      @csrf
      <div class="row">
        <div><label for="name">Nome</label><input id="name" name="name" required maxlength="100" value="{{ old('name', 'claude') }}"></div>
        <div><label for="days">Validade (dias)</label><input id="days" name="days" type="number" min="1" max="{{ $maxDays }}" required value="{{ old('days', 90) }}"></div>
        <button type="submit">Gerar token</button>
      </div>
      @foreach ($errors->all() as $error)
        <div class="error">{{ $error }}</div>
      @endforeach
    </form>
  </section>

  <section>
    @if ($tokens->isEmpty())
      <p style="margin:0">Nenhum token.</p>
    @else
      <div class="scroll"><table>
        <thead><tr><th>Nome</th><th>Criado</th><th>Expira</th><th>Último uso</th><th></th></tr></thead>
        <tbody>
        @foreach ($tokens as $token)
          <tr>
            <td>{{ $token->name }}</td>
            <td>{{ $token->created_at->format('d/m/Y') }}</td>
            <td>{{ $token->expires_at->format('d/m/Y') }}{{ $token->expires_at->isPast() ? ' (expirado)' : '' }}</td>
            <td>{{ $token->last_used_at?->format('d/m/Y H:i') ?? '—' }}</td>
            <td>
              <form method="post" action="{{ route('studio-tokens.destroy', $token->id) }}">
                @csrf @method('DELETE')
                <button class="ghost" type="submit">Revogar</button>
              </form>
            </td>
          </tr>
        @endforeach
        </tbody>
      </table></div>
    @endif
  </section>
</main>
</body>
</html>
