import os
import argparse
import re

# Parse command line argument for the file name
parser = argparse.ArgumentParser(description="Create a new blog HTML file and update blog.html.")
parser.add_argument('file_name', help="The name of the HTML file to be created.")
args = parser.parse_args()

# Create a new HTML file in the blog directory
new_file_path = os.path.join('blog', f'{args.file_name}.html')

default_html_content = f"""
<!DOCTYPE html>
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
        <link rel="canonical" href="https://pendulumpsychology.com.au/blog/{args.file_name}.html">
        <link rel="alternate" href="https://pendulumpsychology.com.au/blog/{args.file_name}.html" hreflang="en-AU">
        <meta charset="utf-8"/>
        <meta property="og:locale" content="en_AU">
        <meta property="og:title" content="TODO | Pendulum Psychology" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://pendulumpsychology.com.au/blog/{args.file_name}.html" />
        <meta property="og:image" content="https://pendulumpsychology.com.au/android-chrome-512x512.png" />
        <meta property="og:description" content="TODO">
        <meta property="og:site_name" content="TODO | Pendulum Psychology">
        <!-- JSON-LD markup generated by Google Structured Data Markup Helper. -->
        <script type="application/ld+json">
        {{
              "@context": "https://schema.org",
              "@type": "Blog",
              "mainEntityOfPage": {{
                "@type": "WebPage",
                "@id": "https://pendulumpsychology.com.au/blog/{args.file_name}.html"
              }},
              "headline": "TODO",
              "image": "https://pendulumpsychology.com.au/android-chrome-512x512.png",  
              "author": {{
                "@type": "Person",
                "name": "David O'Donohue"
              }},
              "publisher": {{
                "@type": "Organization",
                "name": "Pendulum Psychology",
                "logo": {{
                  "@type": "ImageObject",
                  "url": "https://pendulumpsychology.com.au/android-chrome-512x512.png"
                }}
              }},
              "datePublished": "TODO",
              "description": "TODO"
            }}
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
        <h1>TODO: Title</h1>
        <br><br>
        <p class="italics">Last updated TODO: date</p>
        <br><br>
        <p class="italics">Share this post via:</p>
        <br>
<!-- Share buttons -->
        <div class="share-buttons">
          <a class="share-button" href="https://www.facebook.com/sharer/sharer.php?u=https://pendulumpsychology.com.au/blog/{args.file_name}.html" target="_blank">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="#1877F2" style="width:32px;height:32px;border:0;"><!-- Facebook SVG --><path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.78 90.69 226.38 209.25 245V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.28c-30.8 0-40.41 19.12-40.41 38.73V256h68.78l-11 71.69h-57.78V501C413.31 482.38 504 379.78 504 256z"/></svg></a>
          <a class="share-button" href="fb-messenger://share/?link=https://pendulumpsychology.com.au/blog/{args.file_name}.html" target="_blank">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="#00B2FF" style="width:32px;height:32px;border:0;"><!--Messenger SVG --><path d="M256.55 8C116.52 8 8 110.34 8 248.57c0 72.3 29.71 134.78 78.07 177.94 8.35 7.51 6.63 11.86 8.05 58.23A19.92 19.92 0 0 0 122 502.31c52.91-23.3 53.59-25.14 62.56-22.7C337.85 521.8 504 423.7 504 248.57 504 110.34 396.59 8 256.55 8zm149.24 185.13l-73 115.57a37.37 37.37 0 0 1-53.91 9.93l-58.08-43.47a15 15 0 0 0-18 0l-78.37 59.44c-10.46 7.93-24.16-4.6-17.11-15.67l73-115.57a37.36 37.36 0 0 1 53.91-9.93l58.06 43.46a15 15 0 0 0 18 0l78.41-59.38c10.44-7.98 24.14 4.54 17.09 15.62z"/></svg></a>
          <a class="share-button" href="whatsapp://send?text=https://pendulumpsychology.com.au/blog/{args.file_name}.html" target="_blank">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="#25D366" style="width:32px;height:32px;border:0;"><!-- WhatsApp SVG --><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg></a>
          <a class="share-button" href="https://twitter.com/intent/tweet?url=https://pendulumpsychology.com.au/blog/{args.file_name}.html" target="_blank">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="#1DA1F2" style="width:32px;height:32px;border:0;"><!-- Twitter SVG --><path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"/></svg></a>
          <a class="share-button" href="https://www.linkedin.com/shareArticle?mini=true&url=https://pendulumpsychology.com.au/blog/{args.file_name}.html&title=TODOTO%20DO&source=Pendulum%20Psychology" target="_blank">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="#0A66C2" style="width:32px;height:32px;border:0;"><!-- LinkedIn SVG --><path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z"/></svg></a>
          <a class="share-button" href="mailto:?subject=A%20Worthwhile%20Read%20from%20Pendulum%20Psychology&body=https://pendulumpsychology.com.au/blog/{args.file_name}.html" target="_blank">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="#D44638" style="width:32px;height:32px;border:0;"><!-- Email SVG --><path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/></svg></a>
        </div>
        <br>
        <img src="TODO" style="max-width:100%;"/>
        <p>
          TODO: CONTENT
          <img src="TODO" style="float: left; max-width: 200px; margin: 10px;">
        </p>
        </section>
        </main>
        <!-- START_FOOTER -->
        <!-- END_FOOTER -->
        <script src="https://pendulumpsychology.com.au/script.js"></script>
    </body>
</html>
"""

with open(new_file_path, 'w') as file:
    file.write(default_html_content)

# Update blog.html in the current directory
with open('blog.html', 'r+') as file:
    content = file.read()
    position = content.find('<!-- MORE_POSTS -->')

    if position != -1:
        new_content = f'''
        <div class="card">
            <img src="TODO" alt="TODO" class="card-img">
            <h2 class="card-title">TODO: Title</h2>
            <p class="card-desc">In development.</p>
            <a href="https://pendulumpsychology.com.au/blog/{args.file_name}.html" class="card-btn">Read More</a>
        </div>
        <!-- MORE_POSTS -->'''

        content = content[:position] + new_content + content[position+len('<!-- MORE_POSTS -->'):]

    file.seek(0)
    file.write(content)
    file.truncate()
