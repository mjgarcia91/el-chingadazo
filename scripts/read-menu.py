from pathlib import Path
import pypdfium2 as pdfium
from pypdf import PdfReader

source = Path(r'C:\Users\magaa\Downloads\Menu el chingadazo.pdf')
root = Path(__file__).resolve().parent.parent
target = root / 'tmp' / 'pdfs'
target.mkdir(parents=True, exist_ok=True)
document = pdfium.PdfDocument(str(source))
for i, page in enumerate(document):
    page.render(scale=2).to_pil().save(target / f'menu-page-{i+1}.png')
reader = PdfReader(source)
for i, page in enumerate(reader.pages):
    for j, image in enumerate(page.images):
        file = target / f'image-{i+1}-{j+1}-{image.name}'
        file.write_bytes(image.data)
        print(file.name, image.image.size)
