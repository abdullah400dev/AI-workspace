from typing import BinaryIO, Union
from PyPDF2 import PdfReader
from PyPDF2.errors import PdfReadError
from email import message_from_string

def parse_pdf(file: Union[str, BinaryIO]) -> str:
    """
    Extract text content from a PDF file or file-like object.
    
    Args:
        file: Either a file path (str) or a file-like object containing PDF data
        
    Returns:
        str: Extracted text from the PDF
        
    Raises:
        ValueError: If the PDF cannot be read or is empty
        Exception: For other unexpected errors
    """
    try:
        # Create a PDF reader object
        pdf_reader = PdfReader(file)
        
        # Check if PDF is encrypted
        if pdf_reader.is_encrypted:
            # Try with empty password as many PDFs have empty owner passwords
            try:
                pdf_reader.decrypt('')
            except:
                raise ValueError("Cannot extract text from password-protected PDF")
        
        # Extract text from each page
        text_parts = []
        for page in pdf_reader.pages:
            try:
                page_text = page.extract_text()
                if page_text:  # Only add non-empty text
                    text_parts.append(page_text)
            except Exception as e:
                # Skip pages that can't be extracted
                continue
        
        if not text_parts:
            raise ValueError("No extractable text found in PDF")
            
        # Combine all text with double newlines between pages
        return "\n\n".join(text_parts)
    
    except PdfReadError as e:
        raise ValueError(f"Invalid PDF file: {str(e)}")
    except Exception as e:
        raise Exception(f"Failed to parse PDF: {str(e)}")

def parse_eml(file_path):
    with open(file_path, 'r') as f:
        raw_email = f.read()
    msg = message_from_string(raw_email)
    return msg.get_payload(decode=True).decode(errors="ignore")

def parse_file(file_path: str) -> list[str]:
    """
    Parse a file and return its content as a list of strings (pages/chunks).
    
    Args:
        file_path: Path to the file to parse
        
    Returns:
        List of strings, where each string represents a page or chunk of the document
        
    Raises:
        ValueError: If the file type is not supported or the file cannot be parsed
        Exception: For other unexpected errors
    """
    try:
        if file_path.lower().endswith(".txt"):
            with open(file_path, "r", encoding="utf-8") as f:
                return [f.read()]
        
        elif file_path.lower().endswith(".pdf"):
            with open(file_path, "rb") as f:
                return [parse_pdf(f)]
                
        elif file_path.lower().endswith(".eml"):
            return [parse_eml(file_path)]
            
        else:
            raise ValueError(f"Unsupported file type: {file_path.split('.')[-1]}. Supported types: .txt, .pdf, .eml")
            
    except Exception as e:
        raise ValueError(f"Failed to parse file {file_path}: {str(e)}")
