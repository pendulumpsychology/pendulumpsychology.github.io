import sys
import os
import argparse
import json

def create_html_file(file_name):
    # Ensure file has .html extension
    if not file_name.endswith('.html'):
        file_name = f"{file_name}.html"
    
    # Create JSON-LD content
json_ld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "TODO",
    "description": "TODO",
    "url": f"https://www.pendulumpsychology.com.au/{file_name}",
    "image": "https://pendulumpsychology.com.au/android-chrome-512x512.png",
    "author": {
        "@type": "Person",
        "name": "David O'Donohue"
    }
}

    template = f"""<!DOCTYPE html>
<html lang="en-AU">
    <head>
        <meta name='viewport' content='width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0'>
        <link rel="apple-touch-icon" sizes="180x180" href="https://pendulumpsychology.com.au/apple-touch-icon.png">
        <link rel="icon" type="image/png" sizes="32x32" href="https://pendulumpsychology.com.au/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="https://pendulumpsychology.com.au/favicon-16x16.png">
        <link rel="manifest" href="https://pendulumpsychology.com.au/site.webmanifest">
        <link rel="mask-icon" href="https://pendulumpsychology.com.au/safari-pinned-tab.svg" color="#5bbad5">
        <link href="https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://pendulumpsychology.com.au/style.css">
        <meta name="msapplication-TileColor" content="#da532c">
        <meta name="theme-color" content="#ffffff">
        <title>TODO | Pendulum Psychology</title>
        <meta name="description" content="TODO"/>
        <meta name="robots" content="index, follow">
        <link rel="canonical" href="https://pendulumpsychology.com.au/{file_name}">
        <link rel="alternate" href="https://pendulumpsychology.com.au/{file_name}" hreflang="en-AU">
        <meta charset="utf-8"/>
        <meta property="og:locale" content="en_AU">
        <meta property="og:title" content="TODO | Pendulum Psychology" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://pendulumpsychology.com.au/{file_name}" />
        <meta property="og:image" content="https://pendulumpsychology.com.au/android-chrome-512x512.png" />
        <meta property="og:description" content="TODO">
        <meta property="og:site_name" content="TODO | Pendulum Psychology">
        <!-- JSON-LD markup generated by Google Structured Data Markup Helper. -->
        <script type="application/ld+json">
{json.dumps(json_ld, indent=4)}
        </script>
    </head>
        <!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FTF6SY9Y3J"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());

  gtag('config', 'G-FTF6SY9Y3J');
</script>
    <body>
        <!-- START_NAVBAR -->
        <!-- END_NAVBAR -->
        <main>
        <section class="content">
            Content
        </section>
        </main>
        <!-- START_FOOTER -->
        <!-- END_FOOTER -->
        <script src="https://pendulumpsychology.com.au/script.js"></script>
    </body>
</html>
"""

    # Write the file
    with open(file_name, 'w') as f:
        f.write(template)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a new HTML file with proper metadata and structure.")
    parser.add_argument('file_name', help="The name of the HTML file to be created.")
    args = parser.parse_args()

    create_html_file(args.file_name)
    print(f"Created {args.file_name}")