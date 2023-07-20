import glob

# Open the navbar and footer files and read their content
with open('navbar.html', 'r', encoding='utf8') as file:
    navbar_content = file.read()
with open('footer.html', 'r', encoding='utf8') as file:
    footer_content = file.read()

# Find all HTML files in the current directory
for filename in glob.glob('*.html') + glob.glob('articles/*.html'):
    with open(filename, 'r', encoding='utf8') as file:
        content = file.read()
    
    # Find the navbar and footer sections by looking for the start and end tags
    start_navbar = content.find('<!-- START_NAVBAR -->')
    end_navbar = content.find('<!-- END_NAVBAR -->')
    start_footer = content.find('<!-- START_FOOTER -->')
    end_footer = content.find('<!-- END_FOOTER -->')

    # List to hold the replacements to be made
    replacements = []
    if start_navbar != -1 and end_navbar != -1:
        replacements.append((start_navbar, end_navbar, navbar_content, '<!-- START_NAVBAR -->', '<!-- END_NAVBAR -->'))
    if start_footer != -1 and end_footer != -1:
        replacements.append((start_footer, end_footer, footer_content, '<!-- START_FOOTER -->', '<!-- END_FOOTER -->'))

    # Sort the replacements in reverse order (from last to first)
    replacements.sort(reverse=True)

    # Make the replacements
    for start, end, new_content, start_comment, end_comment in replacements:
        content = content[:start + len(start_comment)] + new_content + content[end:]

    # Write the updated content back to the file
    with open(filename, 'w', encoding='utf8') as file:
        file.write(content)
