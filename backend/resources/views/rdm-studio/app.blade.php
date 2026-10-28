<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="csrf-token" content="{{ csrf_token() }}">
<meta name="site-url" content="{{ config('hosts.site') }}">
<title>RDM Studio</title>
<link rel="icon" href="{{ asset('admin/rdm-studio/favicon.svg') }}" type="image/svg+xml">
<link rel="stylesheet" href="{{ asset('admin/rdm-studio/admin.css') }}">
</head>
<body>
<div id="admin-root"></div>
<script type="module" src="{{ asset('admin/rdm-studio/admin.js') }}"></script>
</body>
</html>
