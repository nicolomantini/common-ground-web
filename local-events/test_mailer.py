import io, unittest
from unittest.mock import patch
import mailer
class MailerTests(unittest.TestCase):
    def test_off_never_sends(self):
        with patch.dict('os.environ',{},clear=True),patch('mailer.urlopen') as send:
            with self.assertRaises(ValueError):mailer.send_preview({'id':'one'})
            send.assert_not_called()
    def test_only_configured_inbox(self):
        import json
        config={'EMAIL_DELIVERY':'test','RESEND_API_KEY':'fake','EMAIL_TEST_RECIPIENT':'owner@example.com'}
        with patch.dict('os.environ',config,clear=True),patch('mailer.urlopen',return_value=io.BytesIO(b'{"id":"sent-test"}')) as send:
            self.assertEqual(mailer.send_preview({'id':'one','recipient':'attendee@example.com','subject':'Welcome','body':'Test'}),'sent-test')
            self.assertEqual(send.call_args.args[0].get_header('User-agent'),'CommonGroundLocal/1.0')
            payload=json.loads(send.call_args.args[0].data)
            self.assertEqual(payload['to'],['owner@example.com'])
            self.assertEqual(payload['from'],'Common Ground <hello@common-ground.space>')

    def test_resend_errors_are_actionable(self):
        from urllib.error import HTTPError
        config={'EMAIL_DELIVERY':'test','RESEND_API_KEY':'secret','EMAIL_TEST_RECIPIENT':'owner@example.com'}
        error=HTTPError('https://api.resend.com/emails',403,'Forbidden',{},io.BytesIO(b'{"name":"validation_error"}'))
        with patch.dict('os.environ',config,clear=True),patch('mailer.urlopen',side_effect=error):
            with self.assertRaisesRegex(ValueError,'HTTP 403') as result:mailer.send_preview({'id':'one','subject':'Welcome','body':'Test'})
            self.assertNotIn('secret',str(result.exception))
