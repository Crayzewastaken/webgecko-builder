import zipfile
import xml.etree.ElementTree as ET
import os

def extract_text_from_docx(docx_path, output_path):
    if not os.path.exists(docx_path):
        print(f"Error: {docx_path} does not exist.")
        return
    
    # docx is a zip file
    try:
        with zipfile.ZipFile(docx_path) as docx:
            # The XML containing the main document text
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            
            # w: namespace
            namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            # Extract paragraphs
            paragraphs = []
            for p in root.findall('.//w:p', namespaces):
                texts = []
                for t in p.findall('.//w:t', namespaces):
                    if t.text:
                        texts.append(t.text)
                if texts:
                    paragraphs.append(''.join(texts))
                else:
                    paragraphs.append('') # Empty line for spacing
            
            # Join paragraphs and write to file
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(paragraphs))
            print(f"Successfully extracted text to {output_path}")
            
    except Exception as e:
        print(f"Failed to parse {docx_path}: {e}")

if __name__ == '__main__':
    # Extract audit report
    extract_text_from_docx(
        'c:/Users/zackr/webgecko/WebGecko-Audit-Report.docx', 
        'c:/Users/zackr/webgecko/scratch/WebGecko-Audit-Report.txt'
    )
    # Extract onboarding doc
    extract_text_from_docx(
        'c:/Users/zackr/webgecko/WebGecko-Social-Onboarding.docx', 
        'c:/Users/zackr/webgecko/scratch/WebGecko-Social-Onboarding.txt'
    )
