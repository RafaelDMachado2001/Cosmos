<!doctype html>
<html lang="{{ $locale }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{{ $title }}</title>
</head>
<body>
<main>
<h1>{{ $title }}</h1>
@foreach ($paragraphs as $paragraph)
<p>{{ $paragraph }}</p>
@endforeach
</main>
<p><a href="/{{ $locale }}">{{ $locale === 'pt' ? 'Voltar ao inicio' : 'Back to home' }}</a></p>
</body>
</html>
